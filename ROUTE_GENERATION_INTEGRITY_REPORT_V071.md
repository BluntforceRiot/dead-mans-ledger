# Dead Man's Ledger v0.7.1 Route Generation Integrity Report

## Summary

- Contracts tested: 60000
- Offices tested: 4
- Journeys tested: 1, 5, 10
- Contracts per office/journey: 5000
- Contracts with connectivity-activated routes: 22700
- Destination-activated routes: 27026
- Adjacency-activated routes: 0
- Connectivity clean rate: 52.4%
- Empirical incident rate: 46.6%
- Displayed estimated risk: 47.2%
- Tutorial-protected route count: 20000

## Acceptance Checks

- PASS: Expected contract sample size generated.
- PASS: Destination path activation occurred in sampled contracts.
- PASS: Adjacency activation counted.
- PASS: Connectivity-activated routes were measured.
- PASS: Connectivity-activated routes are not universally clean (52.4% clean).
- PASS: Empirical incident rate is nonzero (46.6%).
- PASS: Empirical incident rate broadly matches displayed risk (46.6% vs 47.2%).
- PASS: Every generated contract has a valid active destination path.
- PASS: Every current station has at least one legal exit.
- PASS: Every active route has generated hazards or explicit tutorial protection.
- PASS: Only first-journey contracts receive exactly one tutorial-protected route.

## Findings

- None.

## Office/Journey Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| New York Financial Hub / Journey 1 | 5000 | 1624 | 1872 | 0 | 74.3% | 26.4% | 27.0% | 5000 |
| New York Financial Hub / Journey 5 | 5000 | 1593 | 1860 | 0 | 49.6% | 49.8% | 50.4% | 0 |
| New York Financial Hub / Journey 10 | 5000 | 1595 | 1851 | 0 | 35.6% | 64.2% | 64.5% | 0 |
| St. Louis Gateway / Journey 1 | 5000 | 2059 | 2504 | 0 | 73.7% | 25.3% | 26.3% | 5000 |
| St. Louis Gateway / Journey 5 | 5000 | 2099 | 2508 | 0 | 51.0% | 49.0% | 49.6% | 0 |
| St. Louis Gateway / Journey 10 | 5000 | 2051 | 2474 | 0 | 35.2% | 63.2% | 63.7% | 0 |
| New Orleans Gulf Office / Journey 1 | 5000 | 1650 | 1912 | 0 | 74.1% | 25.8% | 26.7% | 5000 |
| New Orleans Gulf Office / Journey 5 | 5000 | 1687 | 1942 | 0 | 53.0% | 49.4% | 50.0% | 0 |
| New Orleans Gulf Office / Journey 10 | 5000 | 1689 | 1935 | 0 | 37.3% | 63.6% | 64.1% | 0 |
| San Francisco Mint Office / Journey 1 | 5000 | 2092 | 2572 | 0 | 71.1% | 26.6% | 27.4% | 5000 |
| San Francisco Mint Office / Journey 5 | 5000 | 2107 | 2600 | 0 | 48.5% | 50.0% | 50.7% | 0 |
| San Francisco Mint Office / Journey 10 | 5000 | 2454 | 2996 | 0 | 34.7% | 64.2% | 64.8% | 0 |

## Journey Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Journey 1 | 20000 | 7425 | 8860 | 0 | 73.1% | 26.0% | 26.8% | 20000 |
| Journey 5 | 20000 | 7486 | 8910 | 0 | 50.4% | 49.6% | 50.2% | 0 |
| Journey 10 | 20000 | 7789 | 9256 | 0 | 35.6% | 63.8% | 64.3% | 0 |

## Office Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| New York Financial Hub | 15000 | 4812 | 5583 | 0 | 52.4% | 46.9% | 47.4% | 5000 |
| St. Louis Gateway | 15000 | 6209 | 7486 | 0 | 53.1% | 45.9% | 46.6% | 5000 |
| New Orleans Gulf Office | 15000 | 5026 | 5789 | 0 | 54.5% | 46.4% | 47.0% | 5000 |
| San Francisco Mint Office | 15000 | 6653 | 8168 | 0 | 50.3% | 47.1% | 47.7% | 5000 |
