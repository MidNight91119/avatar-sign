/**
 * Caption parsing and cleanup (spec §2): YouTube json3, WebVTT, and normalisation into
 * sorted, non-overlapping cues of a sensible length for glossing.
 */
import type { Caption } from "@signstream/shared";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (ENTITIES[k] !== undefined) return ENTITIES[k];
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return m;
  });
}

/** Decodes entities, strips tags like <c> and [Music], speaker arrows, and extra spaces. */
export function cleanCaptionText(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*\]|\([^)]*(music|applause|laughter|laughs)[^)]*\)/gi, " ")
    .replace(/^\s*(>>|-)\s*/gm, " ")
    .replace(/♪/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** YouTube timedtext `fmt=json3`. */
export function parseJson3(json: unknown): Caption[] {
  const events = (json as { events?: unknown[] })?.events;
  if (!Array.isArray(events)) return [];
  const out: Caption[] = [];
  for (const ev of events as Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>) {
    if (!ev.segs || ev.tStartMs === undefined) continue;
    const text = ev.segs.map((s) => s.utf8 ?? "").join("");
    if (!text.trim()) continue;
    const start = ev.tStartMs / 1000;
    out.push({ start, end: start + (ev.dDurationMs ?? 0) / 1000, text });
  }
  return out;
}

function vttTime(t: string): number {
  const parts = t.trim().replace(",", ".").split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) throw new Error(`Bad VTT timestamp: ${t}`);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Minimal WebVTT parser: cue timings + text, ignoring NOTE/STYLE/REGION blocks and cue settings. */
export function parseVtt(vtt: string): Caption[] {
  const text = vtt.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!/^WEBVTT/.test(text)) throw new Error("Not a WebVTT file (missing WEBVTT header)");
  const out: Caption[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i === -1) continue;
    const [from, rest] = lines[i]!.split("-->");
    const to = rest!.trim().split(/\s+/)[0]!;
    const cueText = lines.slice(i + 1).join(" ");
    if (!cueText.trim()) continue;
    out.push({ start: vttTime(from!), end: vttTime(to), text: cueText });
  }
  return out;
}

function vttStamp(sec: number): string {
  const ms = Math.round(Math.max(0, sec) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}

/** Shows one gloss for learners: fingerspelling as `fs-WORD` (the usual ASL gloss notation). */
const showGloss = (gloss: string) => (gloss.startsWith("FS:") ? `fs-${gloss.slice(3)}` : gloss);

/** Exports a sign track's gloss as a WebVTT subtitle track: one cue per segment, empty segments skipped. */
export function toVtt(segments: { start: number; end: number; signs: { gloss: string }[] }[]): string {
  const cues = segments
    .filter((s) => s.signs.length > 0 && s.end > s.start)
    .map((s) => `${vttStamp(s.start)} --> ${vttStamp(s.end)}\n${s.signs.map((g) => showGloss(g.gloss)).join(" ")}`);
  return ["WEBVTT", "", ...cues.flatMap((c) => [c, ""])].join("\n");
}

export interface NormalizeOptions {
  /** Merge cues shorter than this (seconds) into the next one. */
  minDuration?: number;
  /** Split cues longer than this (seconds). */
  maxDuration?: number;
}

/** Splits one long cue at punctuation (or word boundaries), sharing time by text length. */
function splitLong(c: Caption, maxDuration: number): Caption[] {
  const dur = c.end - c.start;
  if (dur <= maxDuration) return [c];
  const pieces = Math.ceil(dur / maxDuration);
  let parts = c.text.match(/[^.!?;,]+[.!?;,]*/g)?.map((p) => p.trim()).filter(Boolean) ?? [c.text];
  if (parts.length < pieces) {
    const words = c.text.split(" ");
    const per = Math.ceil(words.length / pieces);
    parts = Array.from({ length: Math.ceil(words.length / per) }, (_, k) => words.slice(k * per, (k + 1) * per).join(" "));
  } else {
    // Group clauses into `pieces` roughly equal chunks.
    const target = c.text.length / pieces;
    const grouped: string[] = [];
    let cur = "";
    for (const p of parts) {
      if (cur && (cur + " " + p).length > target * 1.15) {
        grouped.push(cur);
        cur = p;
      } else cur = cur ? `${cur} ${p}` : p;
    }
    if (cur) grouped.push(cur);
    parts = grouped;
  }
  const total = parts.reduce((n, p) => n + p.length, 0) || 1;
  let t = c.start;
  return parts.map((p, k) => {
    const end = k === parts.length - 1 ? c.end : t + (dur * p.length) / total;
    const cue = { start: round(t), end: round(end), text: p };
    t = end;
    return cue;
  });
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Cleans text, drops empty cues, sorts, removes overlaps (rolling auto-captions overlap),
 * merges cues shorter than ~1s into their neighbour, and splits cues longer than ~8s.
 */
export function normalizeCaptions(cues: Caption[], opts: NormalizeOptions = {}): Caption[] {
  const minDuration = opts.minDuration ?? 1;
  const maxDuration = opts.maxDuration ?? 8;

  const cleaned = cues
    .map((c) => ({ start: c.start, end: Math.max(c.end, c.start), text: cleanCaptionText(c.text) }))
    .filter((c) => c.text.length > 0)
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < cleaned.length - 1; i++) {
    const next = cleaned[i + 1]!;
    if (cleaned[i]!.end > next.start) cleaned[i]!.end = next.start;
  }

  const merged: Caption[] = [];
  let pending: Caption | undefined;
  for (const c of cleaned) {
    if (pending) {
      const gap = c.start - pending.end;
      if (gap < 0.75) {
        pending = { start: pending.start, end: c.end, text: `${pending.text} ${c.text}` };
      } else {
        merged.push(pending);
        pending = c;
      }
    } else pending = c;
    if (pending.end - pending.start >= minDuration) {
      merged.push(pending);
      pending = undefined;
    }
  }
  if (pending) {
    const last = merged.at(-1);
    if (last && pending.start - last.end < 0.75) {
      merged[merged.length - 1] = { start: last.start, end: pending.end, text: `${last.text} ${pending.text}` };
    } else merged.push(pending);
  }

  return merged.flatMap((c) => splitLong(c, maxDuration));
}
