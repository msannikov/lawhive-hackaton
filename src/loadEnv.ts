/**
 * Loads variables from a local `.env` file into process.env (no dependency).
 *
 * Unlike Node's native `process.loadEnvFile`, this fills a variable when it is
 * unset OR set to an empty string — some shells export empty placeholders like
 * `ANTHROPIC_API_KEY=`, which would otherwise shadow the real value in `.env`.
 * A non-empty existing value always wins.
 *
 * Import for side effect before anything reads API keys:
 *   import "./loadEnv.ts";
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function findEnvFile(): string | undefined {
  const candidates = [
    join(process.cwd(), ".env"),
    join(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  ];
  return candidates.find(existsSync);
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

const path = findEnvFile();
if (path) {
  try {
    const vars = parseEnv(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(vars)) {
      const current = process.env[key];
      if (current === undefined || current === "") {
        process.env[key] = value;
      }
    }
  } catch {
    // Unreadable .env — fall back to whatever is already in process.env.
  }
}
