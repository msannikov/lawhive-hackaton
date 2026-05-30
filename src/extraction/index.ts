/**
 * Extraction layer barrel + default provider selection.
 */

import type { ExtractionProvider } from "./types.ts";
import { ClaudeProvider } from "./providers/claude.ts";
import { GeminiProvider } from "./providers/gemini.ts";
import { MockProvider } from "./providers/mock.ts";

export * from "./types.ts";
export { ClaudeProvider } from "./providers/claude.ts";
export { GeminiProvider } from "./providers/gemini.ts";
export { MockProvider } from "./providers/mock.ts";
export { normalizeTenantCase, coerceDate } from "./validate.ts";
export {
  loadDocuments,
  loadDocumentsFromDir,
  documentFromFile,
  documentFromBuffer,
} from "./loadDocument.ts";
export { tenantCaseJsonSchema, tenantCaseGeminiSchema } from "./schema.ts";

/**
 * Picks a provider from the environment:
 *   ANTHROPIC_API_KEY → Claude, else GEMINI/GOOGLE_API_KEY → Gemini,
 *   else Mock (offline). Override with EXTRACTION_PROVIDER=claude|gemini|mock.
 */
export function defaultProvider(): ExtractionProvider {
  const forced = process.env.EXTRACTION_PROVIDER?.toLowerCase();
  if (forced === "claude") return new ClaudeProvider();
  if (forced === "gemini") return new GeminiProvider();
  if (forced === "mock") return new MockProvider();

  if (process.env.ANTHROPIC_API_KEY) return new ClaudeProvider();
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return new GeminiProvider();
  return new MockProvider();
}
