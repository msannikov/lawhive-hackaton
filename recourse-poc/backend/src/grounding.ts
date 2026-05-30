/**
 * Grounding store loader (spec §3.6). Reads the static grounding_store.json
 * (built by scripts/fetchGrounding.ts) into a source_id → chunk Map. This is
 * the ONLY place statute text enters the system; nothing else asserts law text.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { LegalSourceChunkSchema, type LegalSourceChunk } from "./models";

// Re-export the shared normalizers so callers can depend on "the grounding store's" normalize.
export { normalizeForMatch, findNormalized, collapseWhitespace } from "./text";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = resolve(__dirname, "..", "data", "grounding_store.json");

const chunks = z.array(LegalSourceChunkSchema).parse(JSON.parse(readFileSync(STORE_PATH, "utf8")));
const STORE = new Map<string, LegalSourceChunk>(chunks.map((c) => [c.source_id, c]));

export function getChunk(sourceId: string): LegalSourceChunk | undefined {
  return STORE.get(sourceId);
}

export function allChunks(): LegalSourceChunk[] {
  return [...STORE.values()];
}
