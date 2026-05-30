# Law Gun — Deposit Return POC

A minimal, end-to-end vertical slice that drafts a CPR-compliant **Letter Before Claim** for a tenant whose landlord mishandled their deposit (Housing Act 2004, ss 213–214).

The whole design answers one question: *how do you let an LLM write legal documents without it hallucinating the law?* The answer here:

> **The model never decides what the law is, what a deadline is, or what a number is.** It selects from a vetted registry of propositions and fills a template. Everything legally or numerically load-bearing is computed and verified deterministically in code.

The demo payoff is the **provenance drawer**: every legal sentence in the letter is clickable and shows the exact statute text it came from, highlighted, with a green "verified" tick.

## What's in this slice

Three hardcoded cases drive the three terminal outcomes:

| Pick | Case | Outcome |
|------|------|---------|
| **Jamie** | clean breach, ongoing tenancy | **Draft LBC** — verified letter + provenance |
| **Multiple renewals** | same breach, multiple roll-overs | **Escalate** — Superstrike complexity → solicitor handoff |
| **Lodger / licence** | not an assured shorthold tenancy | **Refuse** — out of scope, explained |

Hardcoded "for now": the intake (fixed `DepositCase`s instead of a chat), the grounding store (fetched once and committed), and — by default — the model response (a recorded fixture, so it runs offline).

## Architecture

```
hardcoded case → engines (eligibility · quantum · deadline) → escalation router
   ├─ proceed  → generate (Claude or fixture) → quote-then-cite validator → assemble → letter
   └─ escalate / refuse → handoff package
```

- **Deterministic engines** (`backend/src/engines/`) compute eligibility, the penalty range, and the limitation deadline. Pure functions, unit-tested to exact values.
- **Grounding store** (`backend/data/grounding_store.json`) is real Housing Act 2004 text fetched from legislation.gov.uk. Built by `scripts/fetchGrounding.ts`, which **verifies every registry anchor is present at build time**.
- **Generation** (`backend/src/generation.ts`) — one forced Anthropic tool call; the model only *selects* claim IDs and *fills* narrative slots, with engine numbers injected as data.
- **Quote-then-cite validator** (`backend/src/validator.ts`) — deterministic code (never a prompt). Each claim's quote must be a normalized substring of the cached statute, or the whole letter is rejected.
- **Provenance drawer** (`frontend/src/components/ProvenanceDrawer.tsx`) — the centerpiece UI.

## Run it

Requires Node 18+ (developed on Node 22). **No API key needed** — it runs offline from the fixture by default.

```bash
# 1. install both packages
npm run setup

# 2. (optional) rebuild the grounding store from legislation.gov.uk
npm run fetch:grounding

# 3. backend (terminal 1) — http://localhost:8000
npm run dev:backend

# 4. frontend (terminal 2) — http://localhost:5173
npm run dev:frontend
```

Open **http://localhost:5173** and pick a case.

### Live generation (optional)

By default the backend serves a recorded fixture (`meta.source: "fixture"`). To call the real Anthropic API instead:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export USE_FIXTURE=0
npm run dev:backend
```

The live output flows through the *same* validator — the green ticks stay genuine.

## Tests

```bash
npm test   # vitest — engines, escalation, validator, and the offline fixture path
```

Highlights:
- engine arithmetic matches the spec exactly (penalty £980–£2,940; limitation 2030-10-01; 1,585 days);
- the escalation router routes all three cases correctly;
- **the validator rejects a deliberately-fabricated quote** (`validator.test.ts`) — proof the green ticks mean something;
- the offline fixture passes the real validator (5/5 claims verified).

## API

- `GET /api/cases` → `[{ id, label, blurb }]`
- `POST /api/generate { case_id }` →
  - `{ outcome: "letter", letter, engines, meta }`, or
  - `{ outcome: "escalate" | "refuse", escalation, handoff }`, or
  - `422 { error: "validation_failed", failures }` if a letter can't be verified (never shipped).

## Layout

```
backend/   Hono + TypeScript. models (Zod), registry, grounding, engines,
           escalation, handoff, generation, validator, assembler. Tests in test/.
frontend/  Vite + React + TS. CasePicker, Letter (clickable provenance),
           ProvenanceDrawer, DeadlineCard, HandoffScreen.
```

## Scope & disclaimer

This is a hackathon POC. It provides legal *information* and drafting at the user's instruction and hands off to a regulated solicitor when out of safe scope — it is not legal advice. Grounding is limited to HA 2004 ss 213/214 (the six claims R1, R2, R4–R7); the PI Order, Limitation Act, and s.215 inform the engines but aren't yet verbatim-validated claims.
