/**
 * One-shot grounding-store builder (spec §3.6).
 *
 * Fetches the REAL Housing Act 2004 text from legislation.gov.uk /data.xml,
 * extracts each target subsection by its element id, and writes a static
 * grounding_store.json. Statute text is FETCHED, NEVER INVENTED.
 *
 * Build-time guarantee: every registry `verbatim_anchor` MUST be a normalized
 * substring of its source chunk, or this script throws. That converts "we hope
 * the law still says this" into a hard check that runs whenever we rebuild.
 *
 * Scope note (minimal POC): we fetch only ss 213 & 214, which cover all six
 * registry claims (R1,R2,R4,R5,R6,R7). The PI Order, Limitation Act ss 5/9 and
 * s.215 inform the engines as R-code references (R3/R10) but are not verbatim-
 * validated letter claims, so they are deferred from the store for now.
 *
 * Run: npm run fetch:grounding
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { ALLOWED_CLAIMS } from "../src/registry";
import { LegalSourceChunkSchema, type LegalSourceChunk } from "../src/models";
import { collapseWhitespace, findNormalized } from "../src/text";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "..", "data", "grounding_store.json");

const SECTION_URL: Record<number, string> = {
  213: "https://www.legislation.gov.uk/ukpga/2004/34/section/213/data.xml",
  214: "https://www.legislation.gov.uk/ukpga/2004/34/section/214/data.xml",
};

/** Which subsection element backs each registry source_id. */
const TARGETS: Array<{ source_id: string; section: number; elementId: string }> = [
  { source_id: "ha2004-s213-3", section: 213, elementId: "section-213-3" },
  { source_id: "ha2004-s213-6", section: 213, elementId: "section-213-6" },
  { source_id: "ha2004-s214-1a", section: 214, elementId: "section-214-1-a" },
  { source_id: "ha2004-s214-1A", section: 214, elementId: "section-214-1A" },
  { source_id: "ha2004-s214-3A", section: 214, elementId: "section-214-3A" },
  { source_id: "ha2004-s214-4", section: 214, elementId: "section-214-4" },
];

// Lookup citation + uri by source_id, derived from the registry (single source).
const SOURCE_META = new Map(
  Object.values(ALLOWED_CLAIMS).map((c) => [c.source_id, { citation: c.citation, uri: c.uri }]),
);
// All anchors that must be confirmed present in a given source chunk.
const ANCHORS_BY_SOURCE = new Map<string, string[]>();
for (const c of Object.values(ALLOWED_CLAIMS)) {
  const list = ANCHORS_BY_SOURCE.get(c.source_id) ?? [];
  list.push(c.verbatim_anchor);
  ANCHORS_BY_SOURCE.set(c.source_id, list);
}

const TEXT_NODE = 3;
const CDATA_NODE = 4;

/** Concatenate ALL descendant text in document order (our own, dependency-free). */
function getText(node: any): string {
  const kids = node.childNodes;
  if (!kids || kids.length === 0) return node.nodeValue ?? "";
  let out = "";
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (c.nodeType === TEXT_NODE || c.nodeType === CDATA_NODE) out += c.nodeValue ?? "";
    else out += getText(c);
  }
  return out;
}

function findById(doc: any, id: string): any | null {
  const all = doc.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (typeof el.getAttribute === "function" && el.getAttribute("id") === id) return el;
  }
  return null;
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const retrievedAt = new Date().toISOString().slice(0, 10);

  // Fetch + parse each section once, then extract every target from it.
  const docs = new Map<number, any>();
  for (const [section, url] of Object.entries(SECTION_URL)) {
    process.stdout.write(`Fetching s.${section} … `);
    const xml = await fetchXml(url);
    docs.set(Number(section), new DOMParser().parseFromString(xml, "text/xml"));
    console.log(`${xml.length} bytes`);
  }

  const chunks: LegalSourceChunk[] = [];
  const failures: string[] = [];

  for (const t of TARGETS) {
    const doc = docs.get(t.section);
    const el = findById(doc, t.elementId);
    if (!el) {
      failures.push(`Element #${t.elementId} not found in s.${t.section} (${t.source_id})`);
      continue;
    }
    const text = collapseWhitespace(getText(el));
    const meta = SOURCE_META.get(t.source_id);
    if (!meta) {
      failures.push(`No registry metadata for source_id ${t.source_id}`);
      continue;
    }

    // Build-time guarantee: every anchor for this source must be present.
    for (const anchor of ANCHORS_BY_SOURCE.get(t.source_id) ?? []) {
      if (findNormalized(text, anchor) === -1) {
        failures.push(
          `Anchor not found in ${t.source_id}:\n    anchor: "${anchor}"\n    text:   "${text.slice(0, 200)}…"`,
        );
      }
    }

    chunks.push(
      LegalSourceChunkSchema.parse({
        source_id: t.source_id,
        citation: meta.citation,
        uri: meta.uri,
        text,
        in_force_date: null,
        retrieved_at: retrievedAt,
      }),
    );
  }

  if (failures.length > 0) {
    console.error("\n✗ Grounding build FAILED — anchors/elements did not verify:\n");
    for (const f of failures) console.error("  • " + f);
    console.error("\nThe statute text may have changed. Fix the registry anchors and rerun.");
    process.exit(1);
  }

  writeFileSync(OUT_PATH, JSON.stringify(chunks, null, 2) + "\n", "utf8");
  console.log(`\n✓ Wrote ${chunks.length} verified chunks → ${OUT_PATH}\n`);
  for (const c of chunks) {
    console.log(`  ${c.source_id.padEnd(16)} ${c.citation.padEnd(28)} ${c.text.length} chars  ✓ anchor`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
