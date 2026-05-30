# Workflow demo (Remotion)

Programmatic demo video of the document-driven legal toolset pipeline:

**Documents → VLM extraction → normalise → rules engine → toolset**

Built with [Remotion](https://www.remotion.dev/docs/the-fundamentals) — React components rendered frame-by-frame into MP4.

## Setup

```bash
cd Tools
npm install
```

## Refresh demo data

Captures a fresh assessment snapshot from the main repo (offline via `MockProvider`):

```bash
# from repo root
node --experimental-strip-types Tools/scripts/captureAssessment.ts
```

Output: `Tools/src/data/assessment.json`

## Preview in Remotion Studio

```bash
cd Tools
npm run studio
```

Opens the interactive timeline at http://localhost:3000.

## Render MP4

```bash
cd Tools
npm run render
```

Writes `Tools/out/workflow-demo.mp4` (30s, 1920×1080, 30fps).

## Composition timeline

| Frames | Scene |
|--------|-------|
| 0–90 | Title |
| 90–210 | Document upload |
| 210–360 | VLM extraction + provenance |
| 360–510 | Decision trace + branch |
| 510–780 | Toolset + next move |
| 780–900 | Outro |

## Root shortcuts

From the repo root:

```bash
npm run demo:capture   # refresh assessment.json
npm run demo:studio    # open Remotion Studio
npm run demo:render    # render MP4
```
