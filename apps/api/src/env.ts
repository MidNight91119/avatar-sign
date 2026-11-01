import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
const optionalSecret = z
  .string()
  .optional()
  .transform((s) => (s && s.trim() ? s.trim() : undefined));

const blankAsUnset = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalPositiveInt = z.preprocess(blankAsUnset, z.coerce.number().int().positive().optional());

/** API configuration from environment variables (see .env.example). */
export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  CEREBRAS_API_KEY: optionalSecret,
  CEREBRAS_MODEL: z.preprocess(blankAsUnset, z.string().default("gpt-oss-120b")),
  /** "free" paces requests for the free trial (5/min, one at a time); anything else uses paid defaults. Also read by the gloss module. */
  CEREBRAS_TIER: z.preprocess(blankAsUnset, z.string().optional()),
  /** Account-wide Cerebras request budget, shared by all jobs and retries. Defaults depend on CEREBRAS_TIER. */
  CEREBRAS_REQUESTS_PER_MINUTE: optionalPositiveInt,
  CEREBRAS_MAX_CONCURRENT: optionalPositiveInt,
  CEREBRAS_TOKENS_PER_MINUTE: optionalPositiveInt,
  EXA_API_KEY: optionalSecret,
  /** SQLite file for the cache. ":memory:" for tests. */
  DATABASE_URL: z.string().default("./data/signstream.sqlite"),
  /** Extra CORS origins, comma separated (youtube.com, chrome-extension://* and localhost are always allowed). */
  ALLOWED_ORIGINS: csv,
  /** Secret for ?refresh=1 cache rebuilds. Refresh is disabled when unset. */
  ADMIN_SECRET: optionalSecret,
  /** New (uncached) videos per IP per hour. */
  RATE_LIMIT_NEW_VIDEOS_PER_HOUR: z.coerce.number().int().positive().default(20),
  /** Exa /discover searches per IP per hour. */
  RATE_LIMIT_DISCOVER_PER_HOUR: z.coerce.number().int().positive().default(30),
  /** Longest video we gloss, in seconds. */
  MAX_VIDEO_SECONDS: z.coerce.number().int().positive().default(15 * 60),
});
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** Safe summary for logs: shows whether keys are set, never their values. */
export function describeEnv(env: Env): Record<string, string | number> {
  return {
    PORT: env.PORT,
    CEREBRAS_API_KEY: env.CEREBRAS_API_KEY ? "set" : "missing",
    CEREBRAS_MODEL: env.CEREBRAS_MODEL,
    CEREBRAS_TIER: env.CEREBRAS_TIER ?? "(paid defaults)",
    EXA_API_KEY: env.EXA_API_KEY ? "set" : "missing",
    DATABASE_URL: env.DATABASE_URL,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS.join(",") || "(defaults)",
    ADMIN_SECRET: env.ADMIN_SECRET ? "set" : "missing",
    MAX_VIDEO_SECONDS: env.MAX_VIDEO_SECONDS,
  };
}
