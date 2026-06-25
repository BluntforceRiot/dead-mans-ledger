# Design Notes

## Theme

Dead Man's Ledger asks: what do you risk to keep money trusted long enough for independence to function?

```text
The money provided independence. The route was the engine.
```

The game treats independence as economic circulation. Paper money only creates practical independence if it reaches towns, merchants trust it, payroll arrives, and routes survive weather, sabotage, ambushes, and broken infrastructure.

## v0.6.1 Scope

The v0.6.1 patch keeps the v0.6 mechanics intact and hardens final public-submission truth, framing, and release hygiene:

- Contracts now have origin, destination, cargo value, delivery fee, trust weight, urgency, and leg limit.
- The route network persists for the contract instead of rerolling after each dispatch.
- Scout and Telegraph are information tools, not magic counters.
- Protection tools are probabilistic counters with no guaranteed 200-leg survival strategy.
- Express routes are stronger gambles because they carry two incident checks.
- Outlaw Pressure affects hazard density and counter difficulty.
- Credit is a global debt tool with explicit principal, rate, next interest, and repayment.
- Local Tip is now a station-rumor decision instead of always-on busywork.
- Result cards group intel gathered, counters attempted/succeeded/failed, financial mitigation, and protection held in reserve.
- The central board uses Focus Contract and Full Map display modes, a contract ribbon, and a selected-route ledger.
- Displayed danger now uses the same incident-probability formula as route generation.
- Focus Contract uses adaptive corridor framing instead of a fixed whole-country zoom.
- The action panel groups Intelligence, Protection, Infrastructure, and Finance.
- Incident cards and board tokens use richer original SVG scenes and metallic board-piece treatment.
- Route Atlas replaces Map Preview and removes player-facing code references.

## Visual Direction

The public-demo look should feel like a premium board-table ledger, not a muddy western template:

- Polished gold and antique brass for selected routes, important values, medallions, dividers, and buttons.
- Blackened steel, walnut, deep teal, and parchment only where text readability needs it.
- The map remains dominant.
- State boundaries stay subdued during play.
- Event cards are lightweight original SVG board-game scenes rather than diagrams.
- The logo avoids the old plus, padlock, and rail-tie treatment.

## Interaction Model

1. Choose a dispatch office.
2. Read the contract destination, value, fee, and legs remaining.
3. Select a reachable route from the current station.
4. Gather intel and assign counters.
5. Dispatch the shipment.
6. Read the event/result card.
7. Continue toward the destination or face the board if the ledger collapses.

## Prep Roles

- Scout Ahead: physical intel and counter effectiveness bonus.
- Telegraph Report: official/system intel and counter effectiveness bonus.
- Local Tip: free one-use station rumor, only sometimes available.
- Hire Guards: ambush, sabotage, and repair-crew danger.
- Send Repair Crew: track and bridge trouble.
- Decoy Strongbox: ambush and inside leaks.
- Insurance: mitigation only.
- Delay One Day: weather, bridge, cut-wire, and rumor timing.
- Borrow Credit: global once-per-leg cash with explicit debt and interest.
- Repay Debt: visible principal repayment action when cash allows.

## Future Art Hook

The v0.6.1 SVGs are intentional public-demo symbolic art, not final commercial illustration. A later art pass can replace them with hand-painted or higher-fidelity assets without changing the contract/economy rules.
