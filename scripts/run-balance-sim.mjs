import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'balance-sim');
const reportPath = path.join(root, 'BALANCE_REPORT_DEAD_MANS_LEDGER_V072.md');
const runsPerStrategy = 1000;
const maxLegs = 200;

await build({
  root,
  configFile: false,
  logLevel: 'silent',
  build: {
    ssr: path.join(root, 'src', 'game', 'sim.ts'),
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'sim.mjs',
        chunkFileNames: 'chunk-[name].mjs'
      }
    }
  }
});

const sim = await import(pathToFileURL(path.join(outDir, 'sim.mjs')).href);

const strategies = [
  'no-prep',
  'cautious',
  'intel-only',
  'intel-plus-correct-counter',
  'express-heavy',
  'credit-heavy',
  'route-bounce'
];

function rand(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function chooseRoute(state, strategy, next) {
  const legal = sim.getLegalAdjacentRoutes(state);
  if (!legal.length) {
    return undefined;
  }
  if (strategy === 'route-bounce') {
    const backtrack = legal.find((route) => sim.otherEnd(route, state.currentNodeId) === state.previousNodeId);
    if (backtrack) {
      return backtrack;
    }
    const away = legal.filter((route) => !sim.routeClosesDistance(state, route) && sim.otherEnd(route, state.currentNodeId) !== state.contract.destination);
    const nonDestination = legal.filter((route) => sim.otherEnd(route, state.currentNodeId) !== state.contract.destination);
    return [...(away.length ? away : nonDestination.length ? nonDestination : legal)].sort((a, b) => a.baseRisk - b.baseRisk || a.id.localeCompare(b.id))[0];
  }
  const nonBacktrack = legal.filter((route) => sim.otherEnd(route, state.currentNodeId) !== state.previousNodeId);
  const usable = nonBacktrack.length ? nonBacktrack : legal;
  const toward = usable.filter((route) => sim.routeClosesDistance(state, route));
  const base = toward.length ? toward : usable;

  if (strategy === 'express-heavy') {
    const express = usable.filter((route) => route.express);
    if (express.length) {
      return express.sort((a, b) => b.baseRisk - a.baseRisk)[0];
    }
  }

  if (strategy === 'cautious') {
    return [...base].sort((a, b) => a.baseRisk - b.baseRisk)[0];
  }

  if (strategy === 'intel-plus-correct-counter') {
    return [...base].sort((a, b) => Number(sim.routeClosesDistance(state, b)) - Number(sim.routeClosesDistance(state, a)) || Number(a.express) - Number(b.express) || a.baseRisk - b.baseRisk)[0];
  }

  if (strategy === 'no-prep') {
    return base[Math.floor(next() * base.length)];
  }

  return [...base].sort((a, b) => Number(sim.routeClosesDistance(state, b)) - Number(sim.routeClosesDistance(state, a)) || b.payoutMultiplier - a.payoutMultiplier)[0];
}

function applyAction(state, routeId, actionId) {
  return sim.applyPrepAction(state, routeId, actionId);
}

function prepareRoute(state, route, strategy) {
  if (strategy === 'no-prep' || strategy === 'route-bounce') {
    return state;
  }

  if (strategy === 'credit-heavy') {
    state = sim.borrowCredit(state);
  }

  if (strategy === 'cautious') {
    for (const action of ['tip', 'scout', 'telegraph', 'guards', 'repair', 'decoy', 'delay', 'insurance']) {
      state = applyAction(state, route.id, action);
    }
    return state;
  }

  if (strategy === 'intel-only') {
    state = applyAction(state, route.id, 'scout');
    state = applyAction(state, route.id, 'telegraph');
    return state;
  }

  if (strategy === 'express-heavy') {
    state = applyAction(state, route.id, 'scout');
    state = applyAction(state, route.id, 'telegraph');
    state = applyKnownCounters(state, route.id, ['guards', 'repair', 'delay', 'decoy']);
    return state;
  }

  if (strategy === 'intel-plus-correct-counter') {
    const physical = route.tags.some((tag) => ['ambush', 'track', 'bridge', 'false-tip'].includes(tag));
    const official = route.tags.some((tag) => ['weather', 'inside-leak', 'sabotage', 'telegraph'].includes(tag));
    if (physical || !official) {
      state = applyAction(state, route.id, 'scout');
    }
    if (official) {
      state = applyAction(state, route.id, 'telegraph');
    }
    state = applyKnownCounters(state, route.id, ['guards', 'repair', 'decoy', 'delay', 'insurance']);
  }

  return state;
}

function applyKnownCounters(state, routeId, fallback) {
  const routeState = state.routeStates[routeId];
  const wanted = new Set();
  for (const hazardId of routeState.hazardIds) {
    const hazard = sim.hazardById(hazardId);
    for (const counter of hazard.counters) {
      wanted.add(counter);
    }
  }
  for (const action of wanted.size ? wanted : fallback) {
    state = applyAction(state, routeId, action);
  }
  return state;
}

function simulate(strategy, index) {
  const seed = (0x515000 + index * 8191 + strategies.indexOf(strategy) * 9973) >>> 0;
  const office = sim.dispatchOffices[index % sim.dispatchOffices.length].id;
  let state = sim.startSeededRun(seed, office);
  const startingCash = state.cash;
  const next = rand(seed ^ 0xa53a9);
  const prepUse = {};
  const prepAssigned = {};
  const mitigationUse = {};
  const intelUse = {};
  let legs = 0;
  let successes = 0;
  let failures = 0;
  let destinations = 0;
  let expressLegs = 0;
  let interestWithZeroDebt = 0;
  const firstContractId = state.contract.id;
  let firstContractResolved = false;
  let firstContractComplete = false;
  let rumorAvailableLegs = 0;
  let rumorUnavailableLegs = 0;
  const localRumorOutcomes = {};

  while (!state.firedReason && legs < maxLegs) {
    const route = chooseRoute(state, strategy, next);
    if (!route) {
      break;
    }
    if (state.stationRumor.available && !state.stationRumor.used) {
      rumorAvailableLegs += 1;
    } else {
      rumorUnavailableLegs += 1;
    }
    expressLegs += route.express ? 1 : 0;
    const debtBeforePrep = state.borrowedCredit;
    state = prepareRoute(state, route, strategy);
    if (state.borrowedCredit > debtBeforePrep) {
      prepAssigned.borrow = (prepAssigned.borrow ?? 0) + 1;
    }
    const debtBefore = state.borrowedCredit;
    state = { ...state, selectedRouteId: route.id };
    state = sim.resolveDispatch(state, route.id);
    legs += 1;
    const result = state.lastResult;
    if (!result) {
      break;
    }
    if (debtBefore === 0 && result.interestCharge > 0) {
      interestWithZeroDebt += 1;
    }
    successes += result.success ? 1 : 0;
    failures += result.success ? 0 : 1;
    destinations += result.arrivedAtDestination ? 1 : 0;
    if (!firstContractResolved && result.contract.id === firstContractId && result.contractEnded) {
      firstContractResolved = true;
      firstContractComplete = result.arrivedAtDestination;
    }
    if (result.localRumorOutcome) {
      localRumorOutcomes[result.localRumorOutcome] = (localRumorOutcomes[result.localRumorOutcome] ?? 0) + 1;
    }
    for (const action of result.prepUsed) {
      prepUse[action] = (prepUse[action] ?? 0) + 1;
    }
    for (const action of result.assigned) {
      prepAssigned[action] = (prepAssigned[action] ?? 0) + 1;
    }
    for (const action of result.mitigationApplied) {
      mitigationUse[action] = (mitigationUse[action] ?? 0) + 1;
    }
    for (const report of result.intelGathered) {
      intelUse[report.source] = (intelUse[report.source] ?? 0) + 1;
    }
  }

  return {
    strategy,
    legs,
    successes,
    failures,
    destinations,
    expressLegs,
    interestWithZeroDebt,
    fired: Boolean(state.firedReason),
    finalCash: state.cash,
    cashChange: state.cash - startingCash,
    finalDebt: state.borrowedCredit,
    finalScore: state.score,
    finalPressure: state.outlawPressure,
    firstContractComplete,
    firstContractResolved,
    rumorAvailableLegs,
    rumorUnavailableLegs,
    localRumorOutcomes,
    prepUse,
    prepAssigned,
    mitigationUse,
    intelUse
  };
}

function pressureHazardRate(pressure) {
  let hazardCount = 0;
  let routeCount = 0;
  for (let index = 0; index < 120; index += 1) {
    const state = sim.startSeededRun(7000 + index * 97, 'st-louis');
    const routeStates = sim.generateRouteStates(state.seed + index, state.journey, state.currentNodeId, state.contract, pressure);
    for (const routeState of Object.values(routeStates)) {
      if (!routeState.active) {
        continue;
      }
      routeCount += 1;
      hazardCount += routeState.hazardIds.some((id) => id !== 'clean') ? 1 : 0;
    }
  }
  return hazardCount / Math.max(1, routeCount);
}

const results = new Map();
for (const strategy of strategies) {
  results.set(
    strategy,
    Array.from({ length: runsPerStrategy }, (_, index) => simulate(strategy, index))
  );
}

const rows = strategies.map((strategy) => {
  const items = results.get(strategy);
  const legs = items.map((item) => item.legs);
  const failures = items.reduce((sum, item) => sum + item.failures, 0);
  const successes = items.reduce((sum, item) => sum + item.successes, 0);
  const interestBug = items.reduce((sum, item) => sum + item.interestWithZeroDebt, 0);
  const reached200 = items.filter((item) => item.legs >= maxLegs && !item.fired).length;
  const prepUse = {};
  const prepAssigned = {};
  const mitigationUse = {};
  const intelUse = {};
  const localRumorOutcomes = {};
  for (const item of items) {
    for (const [action, count] of Object.entries(item.prepUse)) {
      prepUse[action] = (prepUse[action] ?? 0) + count;
    }
    for (const [action, count] of Object.entries(item.prepAssigned)) {
      prepAssigned[action] = (prepAssigned[action] ?? 0) + count;
    }
    for (const [action, count] of Object.entries(item.mitigationUse)) {
      mitigationUse[action] = (mitigationUse[action] ?? 0) + count;
    }
    for (const [source, count] of Object.entries(item.intelUse)) {
      intelUse[source] = (intelUse[source] ?? 0) + count;
    }
    for (const [outcome, count] of Object.entries(item.localRumorOutcomes)) {
      localRumorOutcomes[outcome] = (localRumorOutcomes[outcome] ?? 0) + count;
    }
  }
  return {
    strategy,
    medianLegs: median(legs),
    averageLegs: mean(legs),
    maxLegs: Math.max(...legs),
    reached200,
    successRate: successes / Math.max(1, successes + failures),
    destinationAverage: mean(items.map((item) => item.destinations)),
    expressAverage: mean(items.map((item) => item.expressLegs)),
    averageFinalCash: mean(items.map((item) => item.finalCash)),
    maxFinalCash: Math.max(...items.map((item) => item.finalCash)),
    averageCashChange: mean(items.map((item) => item.cashChange)),
    maxCashChange: Math.max(...items.map((item) => item.cashChange)),
    averageFinalDebt: mean(items.map((item) => item.finalDebt)),
    averageFinalScore: mean(items.map((item) => item.finalScore)),
    maxFinalScore: Math.max(...items.map((item) => item.finalScore)),
    firstContractCompletionRate: items.filter((item) => item.firstContractComplete).length / Math.max(1, items.length),
    firstContractResolutionRate: items.filter((item) => item.firstContractResolved).length / Math.max(1, items.length),
    rumorAvailabilityRate:
      items.reduce((sum, item) => sum + item.rumorAvailableLegs, 0) /
      Math.max(1, items.reduce((sum, item) => sum + item.rumorAvailableLegs + item.rumorUnavailableLegs, 0)),
    interestBug,
    prepUse,
    prepAssigned,
    mitigationUse,
    intelUse,
    localRumorOutcomes
  };
});

const lowPressureRate = pressureHazardRate(5);
const highPressureRate = pressureHazardRate(90);
const noPrep = rows.find((row) => row.strategy === 'no-prep');
const prepared = rows.find((row) => row.strategy === 'intel-plus-correct-counter');
const cautious = rows.find((row) => row.strategy === 'cautious');
const intelOnly = rows.find((row) => row.strategy === 'intel-only');
const expressHeavy = rows.find((row) => row.strategy === 'express-heavy');
const creditHeavy = rows.find((row) => row.strategy === 'credit-heavy');
const routeBounce = rows.find((row) => row.strategy === 'route-bounce');
const bestPreparedMedian = Math.max(cautious.medianLegs, prepared.medianLegs);
const aggregatePrepUse = rows.reduce(
  (acc, row) => {
    for (const [key, value] of Object.entries(row.prepUse)) acc.counter[key] = (acc.counter[key] ?? 0) + value;
    for (const [key, value] of Object.entries(row.prepAssigned)) acc.assigned[key] = (acc.assigned[key] ?? 0) + value;
    for (const [key, value] of Object.entries(row.mitigationUse)) acc.mitigation[key] = (acc.mitigation[key] ?? 0) + value;
    for (const [key, value] of Object.entries(row.intelUse)) acc.intel[key] = (acc.intel[key] ?? 0) + value;
    return acc;
  },
  { counter: {}, assigned: {}, mitigation: {}, intel: {} }
);
const prepEvidence = {
  scout: (aggregatePrepUse.intel.scout ?? 0) > 0,
  telegraph: (aggregatePrepUse.intel.telegraph ?? 0) > 0,
  tip: (aggregatePrepUse.intel.tip ?? 0) > 0,
  guards: (aggregatePrepUse.counter.guards ?? 0) > 0,
  repair: (aggregatePrepUse.counter.repair ?? 0) > 0,
  decoy: (aggregatePrepUse.counter.decoy ?? 0) > 0,
  delay: (aggregatePrepUse.counter.delay ?? 0) > 0,
  insurance: (aggregatePrepUse.mitigation.insurance ?? 0) > 0 || (aggregatePrepUse.assigned.insurance ?? 0) > 0,
  borrow: (aggregatePrepUse.assigned.borrow ?? 0) > 0 && creditHeavy.averageFinalDebt > 0
};

const acceptance = [
  ['Scout + Telegraph alone cannot guarantee success', intelOnly.reached200 === 0 && intelOnly.successRate < 0.98],
  ['No strategy survived 200 legs with 100% success', rows.every((row) => row.reached200 < runsPerStrategy)],
  ['Credit cannot generate free money', creditHeavy.averageFinalDebt >= 0 && creditHeavy.averageFinalCash < 25000],
  ['Interest is zero at zero debt', rows.every((row) => row.interestBug === 0)],
  ['Outlaw Pressure materially changes outcomes', highPressureRate > lowPressureRate + 0.08],
  ['Express routes have higher incident exposure', expressHeavy.expressAverage > noPrep.expressAverage],
  ['Prepared play outperforms no-prep play', prepared.successRate > noPrep.successRate + 0.15 && prepared.destinationAverage > noPrep.destinationAverage],
  [
    'Destination-directed play is rewarded over bouncing',
    prepared.destinationAverage > routeBounce.destinationAverage + 0.5 && prepared.averageFinalScore > routeBounce.averageFinalScore + 1500
  ],
  [
    'Deliberate route bouncing cannot farm cash or score',
    routeBounce.averageCashChange <= 0 && routeBounce.maxCashChange <= 0 && routeBounce.averageFinalScore <= 0 && routeBounce.maxFinalScore <= 0
  ],
  ['Every preparation action has meaningful evidence', Object.values(prepEvidence).every(Boolean)],
  ['Cash does not explode from cargo value', rows.every((row) => row.averageFinalCash < 5000 && row.maxFinalCash < 15000)],
  ['Cautious Contract 1 completion is in tutorial target range', cautious.firstContractCompletionRate >= 0.6 && cautious.firstContractCompletionRate <= 0.8],
  ['No-prep Contract 1 remains materially worse than cautious play', noPrep.firstContractCompletionRate + 0.12 < cautious.firstContractCompletionRate],
  ['Reckless express Contract 1 remains risky', expressHeavy.firstContractCompletionRate < cautious.firstContractCompletionRate],
  ['Local Tip is not always available', rows.every((row) => row.rumorAvailabilityRate > 0.2 && row.rumorAvailabilityRate < 0.55)]
];

const table = rows
  .map(
    (row) =>
      `| ${row.strategy} | ${row.medianLegs} | ${row.averageLegs.toFixed(1)} | ${row.maxLegs} | ${row.reached200} | ${(row.successRate * 100).toFixed(1)}% | ${(row.firstContractCompletionRate * 100).toFixed(1)}% | ${(row.rumorAvailabilityRate * 100).toFixed(1)}% | ${row.destinationAverage.toFixed(2)} | ${row.expressAverage.toFixed(2)} | $${Math.round(row.averageFinalCash).toLocaleString()} | $${Math.round(row.averageCashChange).toLocaleString()} | $${Math.round(row.maxCashChange).toLocaleString()} | ${Math.round(row.averageFinalScore).toLocaleString()} | ${Math.round(row.maxFinalScore).toLocaleString()} | $${Math.round(row.averageFinalDebt).toLocaleString()} | ${row.interestBug} |`
  )
  .join('\n');

const report = `# Dead Man's Ledger v0.7.2 Balance Report

Generated by \`npm run balance:sim\`.

## Simulation Scope

- ${runsPerStrategy.toLocaleString()} no-prep runs
- ${runsPerStrategy.toLocaleString()} cautious runs
- ${runsPerStrategy.toLocaleString()} intel-only runs
- ${runsPerStrategy.toLocaleString()} intel-plus-correct-counter runs
- ${runsPerStrategy.toLocaleString()} express-heavy runs
- ${runsPerStrategy.toLocaleString()} credit-heavy runs
- ${runsPerStrategy.toLocaleString()} route-bounce runs
- Hard cap: ${maxLegs} legs per run

## Aggregate Results

| Strategy | Median legs | Avg legs | Max legs | 200-leg survivors | Success rate | Contract 1 completion | Rumor availability | Avg destinations | Avg express legs | Avg final cash | Avg cash change | Max cash change | Avg final score | Max final score | Avg final debt | Zero-debt interest bugs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${table}

## Bounce Farming Check

- Route-bounce average cash change: $${Math.round(routeBounce.averageCashChange).toLocaleString()}
- Route-bounce max cash change: $${Math.round(routeBounce.maxCashChange).toLocaleString()}
- Route-bounce average final score: ${Math.round(routeBounce.averageFinalScore).toLocaleString()}
- Route-bounce max final score: ${Math.round(routeBounce.maxFinalScore).toLocaleString()}
- Route-bounce average destinations: ${routeBounce.destinationAverage.toFixed(2)}

## Pressure Check

- Low pressure hazard density: ${(lowPressureRate * 100).toFixed(1)}%
- High pressure hazard density: ${(highPressureRate * 100).toFixed(1)}%

## Acceptance Checks

${acceptance.map(([label, ok]) => `- ${ok ? 'PASS' : 'FAIL'}: ${label}`).join('\n')}

## Contract 1 And Local Rumor Checks

- Cautious first-contract completion: ${(cautious.firstContractCompletionRate * 100).toFixed(1)}%
- No-prep first-contract completion: ${(noPrep.firstContractCompletionRate * 100).toFixed(1)}%
- Express-heavy first-contract completion: ${(expressHeavy.firstContractCompletionRate * 100).toFixed(1)}%
- Average Local Tip availability: ${(mean(rows.map((row) => row.rumorAvailabilityRate)) * 100).toFixed(1)}%
- Local rumor outcomes: ${rows
  .map((row) => `${row.strategy} ${Object.entries(row.localRumorOutcomes).map(([key, value]) => `${key}: ${value}`).join(', ') || 'none'}`)
  .join('; ')}

## Prep Use Evidence

${rows
  .map((row) => {
    const assigned = Object.entries(row.prepAssigned)
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => `${action}: ${count}`)
      .join(', ');
    const counters = Object.entries(row.prepUse)
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => `${action}: ${count}`)
      .join(', ');
    const mitigation = Object.entries(row.mitigationUse)
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => `${action}: ${count}`)
      .join(', ');
    const intel = Object.entries(row.intelUse)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ');
    return `- ${row.strategy}: assigned ${assigned || 'none'}; counters ${counters || 'none'}; mitigation ${mitigation || 'none'}; intel ${intel || 'none'}`;
  })
  .join('\n')}

## Every Prep Action Evidence

${Object.entries(prepEvidence).map(([action, ok]) => `- ${ok ? 'PASS' : 'FAIL'}: ${action}`).join('\n')}
`;

await fs.writeFile(reportPath, report, 'utf8');
console.log(`Wrote ${reportPath}`);

const failed = acceptance.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Balance acceptance failed:');
  for (const [label] of failed) {
    console.error(`- ${label}`);
  }
  process.exit(1);
}
