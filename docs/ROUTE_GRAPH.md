# Route Graph

## Summary

v0.6.1 includes:

- 55 city nodes.
- 80 routes.
- Core, swing, and rare route availability.
- Standard and express route styling.
- Hidden route hazards on a portion of active routes.
- Route-attached prep badges.
- Separate visual treatments for rail, stage/branch, river/sea, and express routes, with stronger hover, selected-route, keyboard-focus, dispatch, and adaptive Focus Contract styling.
- Displayed danger estimates are derived from the same incident-probability model used when hazards are generated.

Nodes remain fixed. Contract route availability and hazards persist for the current destination contract, so the map feels like a known frontier network with changing opportunities instead of rerolling after every dispatch.

## Required Corridors Covered

West Coast:

- Seattle, Portland, Medford, Sacramento, San Francisco, Reno, Los Angeles, San Diego.

Northwest and mountain:

- Seattle, Spokane, Boise, Bozeman, Great Falls, Salt Lake City, Denver.

Northern corridor:

- Great Falls, Fargo, Duluth, Sault Ste. Marie, Detroit, Cleveland, New York, Boston.

Plains corridor:

- Denver, Cheyenne, North Platte, Omaha, Des Moines, Chicago, St. Louis.

Upper Midwest:

- Fargo, Sioux Falls, Minneapolis, Duluth, Milwaukee, Chicago, Des Moines, Omaha.

South and central:

- Santa Fe, Albuquerque, Wichita, Oklahoma City, Kansas City, Dallas, Fort Worth, St. Louis.

Texas and Gulf:

- Dallas, Fort Worth, Austin, San Antonio, Houston, New Orleans.

Eastern:

- St. Louis, Chicago, Detroit, Cleveland, Pittsburgh, Columbus, Cincinnati, Indianapolis, Nashville, Washington, Philadelphia, New York, Boston, Atlanta, Charlotte.

## Express Examples

The graph includes higher-risk/high-payout express routes such as:

- Seattle to Fargo.
- Denver to Chicago.
- St. Louis to Washington.
- San Francisco to Salt Lake City.
- San Antonio to New Orleans.
- Duluth to Detroit.

## Route Fields

Each route in `src/data/routes.ts` includes:

- `id`
- `from`
- `to`
- `type`
- `biome`
- `baseRisk`
- `distanceTier`
- `payoutMultiplier`
- `express`
- `tags`
- `availability`
- `note`

## Availability

At contract generation:

- Core routes are usually active.
- Swing routes are often active.
- Rare routes are less common and usually express or high-leverage.
- If the current station would have no active exits, nearby exits are forced active to prevent a dead contract.

## Hazards

Active routes can hide hazards. The chance is influenced by journey number, route risk, and Outlaw Pressure. Express routes carry higher reward and two incident checks.

Route tags select likely complications:

- Ambush.
- Track Cut.
- Washed Bridge.
- Bad Weather.
- Inside Leak.
- Rival Company Sabotage.
- Telegraph Cut.
- False Local Tip.
- Repair Crew Ambushed.
- Scout Missing.
- Clean Passage.
