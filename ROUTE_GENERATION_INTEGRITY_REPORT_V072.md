# Dead Man's Ledger v0.7.2 Route Generation Integrity Report

## Summary

- Contracts tested: 60000
- Offices tested: 4
- Journeys tested: 1, 5, 10
- Contracts per office/journey: 5000
- Contracts with connectivity-activated routes: 23122
- Destination-activated routes: 27630
- Adjacency-activated routes: 0
- Adjacency-only probe activations: 8
- Contracts missing a fee-eligible opening route: 0
- Runtime-repaired active arrival continuation gaps: 0
- False/bait rumor exact hazard matches: 0
- Connectivity clean rate: 52.1%
- Empirical incident rate: 46.6%
- Displayed estimated risk: 47.2%
- Tutorial-protected route count: 20000

## Acceptance Checks

- PASS: Expected contract sample size generated.
- PASS: Destination path activation occurred in sampled contracts.
- PASS: Adjacency activation occurred in no-contract probe (8 activations).
- PASS: Connectivity-activated routes were measured.
- PASS: Connectivity-activated routes are not universally clean (52.1% clean).
- PASS: Empirical incident rate is nonzero (46.6%).
- PASS: Empirical incident rate broadly matches displayed risk (46.6% vs 47.2%).
- PASS: Every generated contract has a valid active destination path.
- PASS: Every current station has at least one legal exit.
- PASS: Every sampled opening contract has at least one legal fee-eligible route toward the destination.
- PASS: Every sampled active-route arrival has a non-backtracking continuation after runtime route repair.
- PASS: False and bait local rumors never exactly match an adjacent real hazard.
- PASS: Every active route has generated hazards or explicit tutorial protection.
- PASS: Only first-journey contracts receive exactly one tutorial-protected route.

## Findings

- None.

## Office/Journey Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| New York Financial Hub / Journey 1 | 5000 | 1596 | 1860 | 0 | 72.5% | 26.5% | 27.0% | 5000 |
| New York Financial Hub / Journey 5 | 5000 | 1625 | 1900 | 0 | 50.6% | 49.8% | 50.4% | 0 |
| New York Financial Hub / Journey 10 | 5000 | 1603 | 1876 | 0 | 34.8% | 64.3% | 64.6% | 0 |
| St. Louis Gateway / Journey 1 | 5000 | 2075 | 2503 | 0 | 73.6% | 25.4% | 26.3% | 5000 |
| St. Louis Gateway / Journey 5 | 5000 | 2077 | 2505 | 0 | 50.8% | 49.0% | 49.6% | 0 |
| St. Louis Gateway / Journey 10 | 5000 | 2122 | 2583 | 0 | 35.4% | 63.3% | 63.7% | 0 |
| New Orleans Gulf Office / Journey 1 | 5000 | 1770 | 2068 | 0 | 75.7% | 25.9% | 26.7% | 5000 |
| New Orleans Gulf Office / Journey 5 | 5000 | 1787 | 2127 | 0 | 52.9% | 49.4% | 50.1% | 0 |
| New Orleans Gulf Office / Journey 10 | 5000 | 1786 | 2080 | 0 | 35.0% | 63.7% | 64.2% | 0 |
| San Francisco Mint Office / Journey 1 | 5000 | 2108 | 2555 | 0 | 73.3% | 26.6% | 27.4% | 5000 |
| San Francisco Mint Office / Journey 5 | 5000 | 2075 | 2564 | 0 | 48.2% | 50.1% | 50.7% | 0 |
| San Francisco Mint Office / Journey 10 | 5000 | 2498 | 3009 | 0 | 34.8% | 64.4% | 64.8% | 0 |

## Journey Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Journey 1 | 20000 | 7549 | 8986 | 0 | 73.8% | 26.1% | 26.9% | 20000 |
| Journey 5 | 20000 | 7564 | 9096 | 0 | 50.5% | 49.6% | 50.2% | 0 |
| Journey 10 | 20000 | 8009 | 9548 | 0 | 35.0% | 63.9% | 64.3% | 0 |

## Office Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| New York Financial Hub | 15000 | 4824 | 5636 | 0 | 51.5% | 47.0% | 47.5% | 5000 |
| St. Louis Gateway | 15000 | 6274 | 7591 | 0 | 52.9% | 46.0% | 46.7% | 5000 |
| New Orleans Gulf Office | 15000 | 5343 | 6275 | 0 | 54.0% | 46.4% | 47.1% | 5000 |
| San Francisco Mint Office | 15000 | 6681 | 8128 | 0 | 50.1% | 47.1% | 47.7% | 5000 |
