/**
 * Helpers to turn files (or buffers) into the {@link DocumentInput} shape the
 * providers expect. Use these in an orchestrator / API handler to build a
 * {@link CaseInput} from whatever the user uploaded.
 */

import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { DocumentInput } from "../core/types.ts";

const MEDIA: Record<string, DocumentInput["mediaType"]> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function documentFromBuffer(
  name: string,
  mediaType: DocumentInput["mediaType"],
  buf: Buffer,
): DocumentInput {
  return {
    name,
    kind: mediaType === "application/pdf" ? "pdf" : "image",
    mediaType,
    base64: buf.toString("base64"),
  };
}

export async function documentFromFile(path: string): Promise<DocumentInput> {
  const mediaType = MEDIA[extname(path).toLowerCase()];
  if (!mediaType) throw new Error(`Unsupported file type: ${path}`);
  return documentFromBuffer(basename(path), mediaType, await readFile(path));
}

export async function loadDocuments(paths: string[]): Promise<DocumentInput[]> {
  return Promise.all(paths.map(documentFromFile));
}

const SUPPORTED = new Set(Object.keys(MEDIA));

/**
 * Loads every supported document (PDF/PNG/JPEG) in a directory, in sorted
 * filename order, silently skipping unsupported files (e.g. .DS_Store).
 * Use this to accept "whatever the user dropped in the folder".
 */
export async function loadDocumentsFromDir(dir: string): Promise<DocumentInput[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = entries
    .filter((e) => e.isFile() && SUPPORTED.has(extname(e.name).toLowerCase()))
    .map((e) => join(dir, e.name))
    .sort();
  if (!paths.length) throw new Error(`No supported documents (PDF/PNG/JPEG) in ${dir}`);
  return loadDocuments(paths);
}
