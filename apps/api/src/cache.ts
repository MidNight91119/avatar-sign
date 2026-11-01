/** Small key-value cache on Bun's built-in SQLite (spec §3). Values are JSON. */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Cache {
  get<T>(key: string): T | undefined;
  /** `ttlSeconds` undefined = keep forever. */
  set(key: string, value: unknown, ttlSeconds?: number): void;
  delete(key: string): void;
  keys(prefix: string): string[];
  close(): void;
}

export const cacheKeys = {
  track: (videoId: string, lang: string) => `track:${videoId}:${lang}`,
  context: (videoId: string) => `context:${videoId}`,
  discover: (q: string) => `discover:${q.trim().toLowerCase()}`,
  signReference: (word: string) => `signref:${word.trim().toLowerCase()}`,
};

export function createSqliteCache(path: string, now: () => number = Date.now): Cache {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)");
  const getStmt = db.query<{ value: string; expires_at: number | null }, [string]>("SELECT value, expires_at FROM kv WHERE key = ?");
  const setStmt = db.query("INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at");
  const delStmt = db.query("DELETE FROM kv WHERE key = ?");
  const keysStmt = db.query<{ key: string }, [string, number]>(
    "SELECT key FROM kv WHERE key LIKE ? ESCAPE '\\' AND (expires_at IS NULL OR expires_at > ?) ORDER BY key",
  );

  return {
    get<T>(key: string) {
      const row = getStmt.get(key);
      if (!row) return undefined;
      if (row.expires_at !== null && row.expires_at <= now()) {
        delStmt.run(key);
        return undefined;
      }
      return JSON.parse(row.value) as T;
    },
    set(key, value, ttlSeconds) {
      setStmt.run(key, JSON.stringify(value), ttlSeconds === undefined ? null : now() + ttlSeconds * 1000);
    },
    delete(key) {
      delStmt.run(key);
    },
    keys(prefix) {
      const like = `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      return keysStmt.all(like, now()).map((r) => r.key);
    },
    close() {
      db.close();
    },
  };
}
