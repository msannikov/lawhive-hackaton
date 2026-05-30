# Law Gun — Tenancy Deposit demo (Remotion)

Programmatic demo video for **Law Gun**: a tenant uploads deposit evidence, Law Gun reads the docs, matches the legal branch, and outputs a dated action plan.

**Jamie's case:** £980.77 deposit never protected in DPS / mydeposits / TDS → s214 court route with Letter Before Action.

Built with [Remotion](https://www.remotion.dev/docs/the-fundamentals).

## Setup

```bash
cd Tools
npm install
```

## Refresh demo data

Captures Jamie's assessment snapshot from the main repo (offline via `MockProvider`):

```bash
# from repo root
npm run demo:capture
```

Output: `Tools/src/data/assessment.json`

## Preview in Remotion Studio

```bash
npm run demo:studio
```

## Render MP4

```bash
npm run demo:render
```

Writes `Tools/out/workflow-demo.mp4` (41s, 1920×1080, 30fps).

## Scene timeline

| Frames | Scene |
|--------|-------|
| 0–90 | **Law Gun** — Tenancy Deposit Return title + Jamie's case |
| 90–210 | Tenant uploads agreement, bank proof & scheme searches |
| 210–360 | Extract deposit amount, dates & protection status |
| 360–510 | Unprotected branch, key dates & escalation |
| 510–720 | 4-step action plan with deadlines |
| 720–900 | **Letter Before Action** — generated `documentTemplate` |
| 900–1140 | **Negotiation loop** — Round 1 MONITOR → Round 2 lawyer → Round 3 court filing |
| 1140–1230 | Outro |
