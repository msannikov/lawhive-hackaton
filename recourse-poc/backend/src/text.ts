/**
 * Shared text normalization — THE linchpin of the quote-then-cite guarantee.
 *
 * The fetch script (when storing source text), the validator (when comparing),
 * and the build-time anchor check all run text through ONE definition here.
 * If these ever diverged, a quote could "verify" against a string the user is
 * not actually shown, or fail against text that really is present. One function,
 * imported everywhere, is what makes the substring check trustworthy.
 */

/** Readable form for storage/display: collapse runs of whitespace, trim. Case preserved. */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Comparison form for substring matching. Lowercases, maps smart quotes / dashes
 * to ascii, strips zero-width characters, then collapses whitespace. Applied to
 * BOTH sides of every comparison so the match is robust to cosmetic differences.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'") // ' ' ‛ ′ → '
    .replace(/[“”″]/g, '"') // " " ″ → "
    .replace(/[–—]/g, "-") // – — → -
    .replace(/[​‌‍]/g, "") // zero-width chars → removed
    .replace(/\s+/g, " ")
    .trim();
}

/** True if `needle` appears in `haystack` after normalization; -1 offset means no match. */
export function findNormalized(haystack: string, needle: string): number {
  return normalizeForMatch(haystack).indexOf(normalizeForMatch(needle));
}
