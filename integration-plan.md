# Integration Plan — One "Legal Negotiator" product

Merges the two parallel builds into a single frontend + backend product:

- **Team engine** (`src/` — the `Playbook` framework): document-driven, multi-vertical,
  deterministic `assess()` producing a branch + toolset + key dates + negotiation signal.
- **Law Gun** (`recourse-poc/` — grounded-letter POC): cached legislation, quote-then-cite
  validator, Claude letter generation, and the clickable **provenance drawer** UI.

## 1. Product flow (what we're building)

A self-serve "negotiator/helper" that funnels the user from a broad problem space down to a
concrete, dated action plan:

```
Landing
  └─ "What do you need help with?"        ← LOTS of areas (most "coming soon")
       └─ Housing & Tenancy  ✅            ← the live area
            └─ Tenancy sub-areas          ← several options
                 └─ Tenancy deposit return / dispute  ✅   → domain: deposit_return
                      └─ Intake (a few questions)            ← builds the case facts
                           └─ Assessment
                                ├─ Toolset (pickable, each with a real deadline date)
                                ├─ "Your next move" (negotiation framing)
                                ├─ Escalate-to-a-lawyer signal (when info-gathering is exhausted)
                                └─ Timeline / calendar of every dated step (+ ICS)
                                     └─ Tool detail (per tool: exact action + date + template/links)
```

The breadth at the top is deliberate (credibility), but only **Housing & Tenancy → Deposit
return** is live. Everything else renders as visibly disabled "Coming soon" — honest, not faked.

## 2. Target architecture

One server, one web app, the team engine as a library, Law Gun as the deposit "verified-letter"
service.

```
web/   (React+Vite — evolve recourse-poc/frontend)
   Funnel → Intake → Assessment(toolset+timeline) → ToolDetail / ProvenanceDrawer / Handoff
      │  JSON over HTTP
server/ (Hono — evolve recourse-poc/backend)
   GET  /api/taxonomy                              → the funnel tree
   GET  /api/playbooks/:domain/intake-schema       → which questions to ask
   POST /api/assess            {domain, facts}      → assess() from Q&A  (no VLM)
   POST /api/assess/documents  {domain, documents}  → team VLM extract → assess() (optional)
   POST /api/playbooks/deposit_return/letter {facts}→ Law Gun grounded letter + provenance
   POST /api/handoff                                → Law Gun solicitor handoff package
      │  in-process imports (no network hop)
   ┌─────────────────────────────┬───────────────────────────────────────┐
   ▼                             ▼                                         
ENGINE = src/                 GROUNDING = recourse-poc/backend/src         
  core/ (Playbook, Tool,        registry + grounding_store.json            
  CaseAssessment, dates,        validator (quote-then-cite)                
  negotiation)                  generation (Claude + fixture)              
  playbooks/depositReturn       assembler + handoff                        
  playbooks/employmentTermination
  extraction/ (Claude/Gemini/Mock VLM)
```

**Decision: the team's `Playbook` framework is the source of truth** for branch / tools / dates /
negotiation (it scales to multiple verticals, which the funnel needs). **Law Gun becomes the
deposit vertical's premium letter generator + provenance UI**, called by the deposit "letter" tool.

## 3. The funnel taxonomy (served by `GET /api/taxonomy`)

A static tree, with the *live* leaves derived from the playbook registry so they can't drift.
Node shape: `{ id, label, blurb, icon, status: "live" | "coming_soon", children? , domain? }`.

**Level 0 — problem areas (show ~9 for breadth):**
| Area | Status |
|---|---|
| 🏠 Housing & Tenancy | **live** |
| 💼 Employment & Work | live (stub playbook) |
| 🛒 Consumer & Faulty Goods | coming_soon |
| 💷 Debt & Money | coming_soon |
| 🔊 Neighbours & Nuisance | coming_soon |
| 👪 Family & Relationships | coming_soon |
| 🪪 Immigration | coming_soon |
| 📜 Wills & Probate | coming_soon |
| ⚖️ Small Claims | coming_soon |

**Level 1 — under Housing & Tenancy (show ~6):**
| Sub-area | Status → |
|---|---|
| 🔑 **Tenancy deposit return / dispute** | **live** → `domain: deposit_return` |
| 🛠️ Repairs & disrepair | coming_soon |
| 🚪 Eviction / Section 21 | coming_soon |
| 📈 Rent increases | coming_soon |
| 📝 Tenancy agreement issues | coming_soon |
| 🚫 Harassment / illegal eviction | coming_soon |

The funnel component just walks this tree; `coming_soon` nodes are greyed with a badge.

## 4. Intake (the "several questions")

After landing on `deposit_return`, ask the minimal facts the decision tree + `keyDates` need.
Each maps directly to a `TenantCase` field; `landlordResponse` + protection status drive the branch.

| Question (plain English) | TenantCase field | Drives |
|---|---|---|
| How much was the deposit? | `deposit.amount` | penalty range, letter |
| When did you pay it? | `deposit.paidDate` | 30-day + 6-year clocks |
| Has the tenancy ended? (date?) | `tenancy.ended` / `endDate` | return / ADR dates |
| Is the deposit protected? (DPS/mydeposits/TDS / unsure) | `protection.protectedInScheme` (+ `schemeSearches`) | **branch** |
| Were you given the "prescribed information"? | `protection.prescribedInformationGiven` | **branch** |
| How is the landlord responding? agrees / disputes / silent / not asked | `landlordResponse` | **branch** |
| Your name & address; landlord's; property | parties | the letter |

`GET /api/playbooks/:domain/intake-schema` returns this question list so intake is playbook-driven.

**Optional accelerator:** an "Upload your tenancy agreement + bank statement" path routes through
the team's VLM extraction (`evaluateCase` with `documents`) to pre-fill the answers, reusing the
bundled `sample_data/`. Q&A stays primary; upload is a shortcut.

## 5. Assessment screen → the toolset & timelines

`POST /api/assess {domain:"deposit_return", facts}` → server builds the `TenantCase`, calls
`depositReturnPlaybook.assess(case)` → returns `CaseAssessment`. The UI renders:

- **Matched branch** + plain summary + the `reasoning[]` trace ("Show your working").
- **Toolset**: each `Tool` as a pickable card → `title`, `nextAction`, the **deadline date**,
  `deadlineBasis`, `legalBasis`, ordered by `priority`.
- **Your next move** (`nextMove`): the single calibrated step + *why* (negotiation rationale).
- **Escalation banner** (`escalation.level`): green `self_serve` / amber `monitor` /
  red `escalate` → "time to bring in a regulated lawyer", with `reason`.
- **Timeline/calendar**: every dated step aggregated, with ICS export.

### How the existing engine already answers your exact asks

| You asked for… | Comes from | Value |
|---|---|---|
| "by what date to send an email" | `letter-before-action` tool · `keyDates.letterBeforeActionSendBy` (eval + 7d) | a real date |
| "…and when the landlord must reply" | `letterBeforeActionResponseDeadline` (send + 14d) | a real date |
| "by what time to follow up with the landlord" | `chase-*` tools · `keyDates.chaseBy` (eval + 3d); `contractualReturnDeadline` (10 working days after tenancy end) | a real date |
| "by what time to escalate to a lawyer" | `escalation.level === "escalate"` · `keyDates.escalateBy` (eval + 17d) · `claimLimitationLongstop` (breach + 6y) | the decision gate |
| "where to check for scheme existence/non-existence" | `verify-protection-online` tool → official DPS / mydeposits / TDS searches, prefilled with surname, postcode, amount, date | the right links |

## 6. Tool detail (pick a tool → follow-up with exact timeline)

The detail panel is keyed by `tool.category`:

- **`verify`** → scheme-check screen: deep links to the three official "is my deposit protected?"
  searches, prefilled guidance, and a "record result" control (found/not-found per scheme) that
  feeds back into the facts. *(your "where to check for scheme existence/non-existence")*
- **`letter` / `chase`** → letter composer showing `tool.documentTemplate` (the calibrated
  Never-Split-the-Difference letter). For the deposit LBA, call
  `POST /api/playbooks/deposit_return/letter` to get **Law Gun's grounded version** with a
  `provenance_map`, rendered with the **ProvenanceDrawer** (every legal sentence clickable →
  verified against legislation.gov.uk). "Send by {deadline}" + copy / download + ICS.
- **`evidence`** → the evidence checklist (Law Gun handoff checklist + the tool's `nextAction`).
- **`adr` / `court`** → guidance + the escalate CTA → Law Gun `buildHandoff` "handed to a
  regulated solicitor" screen.
- Every panel shows the concrete **deadline date** prominently + "add to calendar".

## 7. The bridge code (the only genuinely new domain logic)

1. **`assessFromFacts(domain, facts)`** in the engine — skips VLM: validates `facts` into the
   playbook's case and calls `assess()`. Lets the Q&A path reuse the playbook unchanged.
2. **`tenantCaseToDepositCase(tc, parties)`** adapter — `TenantCase` (team) → `DepositCase`
   (Law Gun). The two are ~80% aligned; the adapter fills `country`/`tenancy_type` (default
   England/AST, confirmed at intake), party fields, and maps booleans → `yes|no|unknown`. Used only
   by the grounded-letter endpoint.
3. **Escalation reconciliation** — surface the team's richer `EscalationSignal`
   (`self_serve|monitor|escalate`) in the UI; when `level === "escalate"`, build the handoff with
   Law Gun's `buildHandoff`. Out-of-scope is caught at intake (scope questions), not post-assess.

## 8. Repo layout

Recommended (fastest, reuses the only working web tier):

- `src/` — engine, unchanged except the new `assessFromFacts` helper.
- `recourse-poc/backend/` → the **server**: add the routes above; import the engine from `../../src`;
  keep grounding/generation/validator/handoff as the deposit letter service.
- `recourse-poc/frontend/` → the **web app**: add `Funnel`, `Intake`, `Toolset`, `Timeline`,
  `ToolDetail`; reuse `Letter`, `ProvenanceDrawer`, `DeadlineCard`, `HandoffScreen`.

Known wiring task: the engine uses Node native TS (`--experimental-strip-types`, explicit `.ts`
imports); Law Gun uses `tsx`. Run the unified server under one runner (tsx) and set
`allowImportingTsExtensions` so cross-tree `.ts` imports resolve. (M0 spike below.)

Cleaner alternative (if time allows): a `app/{server,web}` workspace that imports both — more setup,
better separation. Not recommended for the hackathon timebox.

## 9. Build milestones

| # | Milestone | Est |
|---|---|---|
| M0 | Workspace spike: one server runner importing both `src/` and `recourse-poc/backend/src` | ~1h |
| M1 | `assessFromFacts` path + `tenantCaseToDepositCase` adapter | ~1h |
| M2 | Server routes: taxonomy, intake-schema, assess, deposit letter, handoff | ~2h |
| M3 | Taxonomy data (breadth + coming-soon, live leaves from registry) | ~0.5h |
| M4 | Frontend funnel screens (area → sub-area) with disabled states | ~2h |
| M5 | Frontend intake (guided Q&A; optional doc-upload prefill) | ~2h |
| M6 | Assessment screen: tool cards + nextMove + escalation banner + reasoning | ~2h |
| M7 | Tool detail panels per category + scheme-check links | ~2h |
| M8 | Timeline/calendar aggregation + ICS export | ~1.5h |
| M9 | Grounded letter + ProvenanceDrawer wired into the deposit letter tool | ~1.5h |
| M10 | Escalate → handoff screen | ~1h |
| M11 | Polish, demo path, eval of the funnel→deposit→tools→letter happy path | ~2h |

## 10. Demo script

1. Land → ~9 problem areas (most "coming soon") → **Housing & Tenancy**.
2. → ~6 tenancy sub-areas → **Tenancy deposit return / dispute**.
3. → short intake (or "use sample case: Jamie" / upload the sample docs).
4. → Assessment: branch + dated toolset + "your next move" + escalate-when banner.
5. → Pick **Verify protection** → 3 scheme links. Pick **Send Letter Before Action** → grounded
   letter with clickable **verified citations**. Timeline shows every date; export ICS.
6. → (optional) flip landlord response to "disputes deductions" → different toolset (ADR); flip to
   multiple renewals / near-limitation → **escalate to a lawyer**.

## 11. Open decisions (confirm to start)

1. **Engine source of truth** — team `Playbook` framework *(recommended)* vs Law Gun.
2. **Intake** — guided Q&A primary + optional upload *(recommended)* vs Q&A-only vs upload-first.
3. **Letter** — Law Gun grounded + provenance for deposit *(recommended)* vs team's static template.
4. **Repo layout** — evolve `recourse-poc/` in place *(recommended)* vs new `app/` workspace.
5. **Breadth** — ~9 problem areas / ~6 tenancy sub-areas shown as the "lots of options" illusion.

## 12. Risks

- **Two runtimes** (native TS vs tsx) — resolved in M0; if painful, run everything under tsx.
- **Two escalation vocabularies** — resolved by adopting the team's `EscalationSignal` in the UI.
- **Scope honesty** — "coming soon" areas must be clearly non-functional; never imply legal
  capability we don't have. Out-of-scope deposit facts → refuse/handoff, not a bad letter.
- **Model drift** — engine pins `claude-opus-4-7`, Law Gun `claude-opus-4-8`; standardise on 4.8.
- **Grounded-letter latency** — keep the fixture-first path for the demo so it runs offline.
</content>
</invoke>
