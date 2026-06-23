# Dead Man's Ledger: The Money Engine Submission Notes

## Project

- Title: Dead Man's Ledger: The Money Engine
- Event: Summer into AI Week 2
- Theme: Independence Engines
- Build: v0.5 final candidate pending live deploy approval

## Short Description

Dead Man's Ledger is a static browser board-game strategy sim about moving currency through dangerous American routes.

The money provided independence. The route was the engine.

## Theme Connection

Dead Man's Ledger treats independence as economic circulation. Paper money only creates practical independence if it reaches frontier towns, merchants trust it, payroll arrives, and routes survive weather, sabotage, ambushes, and broken infrastructure.

## Technical Proof Notes

- Static browser game.
- Vite + TypeScript.
- No backend.
- No login.
- No online leaderboard.
- Local high scores only.
- GitHub Pages workflow prepared, but no push or deploy should happen without explicit approval.

## Map And Data Notes

- The map is generated from open geodata.
- State geometry comes from `us-atlas`.
- Major river overlays use a committed local fallback dataset, with a timed Natural Earth fallback only if the local file is missing.
- City nodes are projected at runtime from latitude/longitude in `src/data/nodes.ts`.
- Route lines are drawn at runtime from `src/data/routes.ts`.
- No Google Maps screenshots are used.
- No AI-generated geography is used.
- AI assistance was limited to ideation, implementation help, visual direction, and symbolic SVG/UI polish.

## Gameplay Proof Notes

- Mouse-first destination contract loop.
- Contracts include origin, destination, cargo type, cargo value, delivery fee, trust weight, and leg limit.
- Prep actions include scouts, guards, repair crews, telegraph reports, local tips, decoys, insurance, delay, and global credit.
- Scout and Telegraph reveal danger but do not automatically counter it.
- Credit tracks explicit debt; interest is charged only when debt exists.
- Outlaw Pressure affects hazard density and counter difficulty.
- Runs end when cash, reputation, or currency trust collapses.
- Reaching the named destination completes the contract.
- Generated WebAudio cues can be toggled with `M`.

## Competitor-Reference Note For Substack

Myles's Dependency Day uses a branching node graph to ask what dependencies you cut. Dead Man's Ledger uses a route graph to ask what risks you take to keep currency moving.

This comparison belongs in external write-up context, not in the game UI.

## Expected Demo URL

```text
https://bluntforceriot.github.io/dead-mans-ledger/
```

## Review Packet

The v0.5 review packet should include:

- Source code.
- Package files.
- Public assets.
- Docs.
- v0.5 screenshots.
- Build receipt.
- Build log.
- Balance report.
- Neuroforge review-loop evidence.
