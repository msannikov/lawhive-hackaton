/**
 * Captures the demo snapshot OFFLINE (MockProvider — deposit fixture).
 *
 * Run from repo root:
 *   npm run demo:capture
 *
 * Output: Tools/src/data/assessment.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MockProvider } from "../../src/extraction/index.ts";
import { buildSnapshot } from "./captureCore.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "data", "assessment.json");

const documents = [
  { name: "tenancy_agreement.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" },
  { name: "bank_statement_deposit_payment.pdf", kind: "pdf", mediaType: "application/pdf", base64: "" },
  { name: "dps_search_result.png", kind: "image", mediaType: "image/png", base64: "" },
  { name: "mydeposits_search_result.png", kind: "image", mediaType: "image/png", base64: "" },
  { name: "tds_search_result.png", kind: "image", mediaType: "image/png", base64: "" },
] as const;

const snapshot = await buildSnapshot(new MockProvider(), [...documents]);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${outPath} (provider: ${snapshot.extraction.provider})`);
