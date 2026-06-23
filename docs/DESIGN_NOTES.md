# Design Notes

## Theme

Dead Man's Ledger asks: what do you risk to keep money trusted long enough for independence to function?

The core thesis is:

```text
The money provided independence. The route was the engine.
```

## v0.2 Scope

The second build keeps the v0.1 foundation and improves public-facing board-game readability:

- Accurate base map pipeline.
- Fixed city coordinate data.
- Dynamic clickable route graph.
- One-player route/prep/dispatch loop.
- Score and survival meters.
- Local high-score storage.
- Board-game style event presentation.
- Larger central map presentation at 1440x900.
- Distinct route-type styling and route-attached prep badges.
- Scout/Telegraph/Local Tip intel split.
- Generated WebAudio cues.
- Six-delivery journey segments and a Route Legend milestone.

It does not attempt final art, online services, multiplayer, or a large simulation economy.

## Interaction Model

The game is mouse-first:

1. Select an active route from the current station.
2. Optionally select a prep action and assign it to a reachable route.
3. Dispatch the shipment.
4. Watch the map token move.
5. Read the event/result card.
6. Continue to the next station with higher risk and payout pressure.

## Prep Actions

Actions are intentionally small and legible:

- Scout Ahead reveals danger and counters ambushes, cuts, weather, false tips, and wire trouble.
- Hire Guards counters ambushes and sabotage.
- Send Repair Crew counters track cuts and washed bridges.
- Telegraph Report reveals official intel and counters weather, leaks, sabotage, and false tips.
- Local Tip is free, unreliable, and can reveal truth, false rumor, or useless dust.
- Decoy Strongbox counters ambushes and inside leaks.
- Insurance softens cash loss.
- Delay One Day counters weather, bridge trouble, and telegraph cuts.
- Borrow Credit is assigned to a route, adds cash, raises interest pressure, lowers trust, and leaves visible credit pressure in the HUD.

## Meters

- Cash is the operating budget and debt risk.
- Score is the score-attack total.
- Reputation is board and public confidence in the route office.
- Currency Trust is whether towns still accept the paper.
- Outlaw Pressure rises as the run continues.
- Interest Rate slowly climbs and taxes every dispatch.
- Journey Number tracks survival depth.

## Scoring

Score rewards:

- Delivered shipment value.
- Route payout multiplier.
- Express-route bonus.
- Risk bonus.
- Correct counter bonus.
- Remaining cash budget bonus.
- Trust streak bonus.
- Journey completion bonus.

Score penalizes:

- Shipment loss.
- Cash damage.
- Failed or uncountered hazards.
- Interest pressure.

## Event Presentation

The v0.1 event system uses reusable SVG cards:

- Ambush.
- Defended Ambush.
- Track Cut.
- Repair Crew.
- Snowstorm.
- Sandstorm.
- Bridge Damage.
- Telegraph Warning.
- Successful Delivery.
- Failed Delivery.
- Inside Leak.
- Decoy Strongbox Success.
- Repair Crew Ambushed.

Future versions can replace these with richer art while keeping the data-driven event layer.

## Future Local Two-Player Hook

The current data model keeps player state and route state separate enough to support local hot-seat later:

- Player 1 selects route/prep/dispatch.
- Player 2 selects route/prep/dispatch.
- Results resolve from the same route graph.
- Scores compare after a fixed number of rounds.

This is intentionally only a design hook in v0.2.
