/**
 * Captures the demo snapshot LIVE via Claude — it actually reads the real
 * documents in sample_data (PDFs + scheme screenshots). This produces the data
 * for the separate "WorkflowDemoClaude" composition.
 *
 * Requires ANTHROPIC_API_KEY (loaded from .env by evaluateCase).
 *
 * Run from repo root:
 *   npm run demo:capture:claude
 *
 * Output: Tools/src/data/assessment.claude.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ClaudeProvider, loadDocumentsFromDir } from "../../src/extraction/index.ts";
import { buildSnapshot } from "./captureCore.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outPath = join(here, "..", "src", "data", "assessment.claude.json");

const documents = await loadDocumentsFromDir(join(repoRoot, "sample_data"));
console.log(`Loaded ${documents.length} real document(s) for Claude extraction.`);

const snapshot = await buildSnapshot(new ClaudeProvider(), documents);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${outPath} (provider: ${snapshot.extraction.provider})`);
