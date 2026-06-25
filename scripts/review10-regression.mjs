import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'review10-regression');

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
        format: 'es',
        entryFileNames: 'sim.mjs'
      }
    }
  }
});

const sim = await import(pathToFileURL(path.join(outDir, 'sim.mjs')).href);

const physicalHazards = new Set(['ambush', 'track-cut', 'washed-bridge', 'repair-ambush', 'scout-missing']);
const officialHazards = new Set(['bad-weather', 'inside-leak', 'rival-sabotage', 'telegraph-cut', 'false-tip']);
const passes = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(message) {
  passes.push(message);
}

function legalRoutes(state) {
  return sim.getLegalAdjacentRoutes(state);
}

function reportFor(routeState, source) {
  return routeState.intelReports.find((report) => report.source === source);
}

function withRouteState(state, route, patch) {
  return {
    ...state,
    routeStates: {
      ...state.routeStates,
      [route.id]: {
        ...state.routeStates[route.id],
        active: true,
        hazardsGenerated: true,
        ...patch
      }
    },
    selectedRouteId: route.id
  };
}

function forceCleanRoute(state, route, extra = {}) {
  return withRouteState(state, route, {
    hazardId: 'clean',
    hazardIds: ['clean'],
    assigned: [],
    intelReports: [],
    revealed: false,
    ...extra
  });
}

function routeHazards(routeState) {
  return routeState.hazardIds.filter((id) => id !== 'clean');
}

function chooseFeeEligibleProgressRoute(state) {
  return legalRoutes(state)
    .filter((route) => !sim.wouldDeadhead(state, route))
    .sort((a, b) => {
      const aDestination = sim.otherEnd(a, state.currentNodeId) === state.contract.destination;
      const bDestination = sim.otherEnd(b, state.currentNodeId) === state.contract.destination;
      return (
        Number(bDestination) - Number(aDestination) ||
        Number(sim.routeClosesDistance(state, b)) - Number(sim.routeClosesDistance(state, a)) ||
        Number(a.express) - Number(b.express) ||
        a.baseRisk - b.baseRisk ||
        a.id.localeCompare(b.id)
      );
    })[0];
}

function testContractHistoryReset() {
  let state = sim.startSeededRun(810001, 'new-york');
  let delivered = false;
  for (let step = 0; step < 12 && !delivered; step += 1) {
    const route = chooseFeeEligibleProgressRoute(state);
    assert(Boolean(route), `seed 810001 step ${step} has a fee-eligible route`);
    const before = forceCleanRoute(state, route);
    state = sim.resolveDispatch(before, route.id);
    delivered = Boolean(state.lastResult?.arrivedAtDestination);
  }
  assert(delivered, 'seed 810001 forced-clean run delivered the first contract');
  assert(Object.keys(state.segmentHistory).length === 0, 'segment history resets when a new contract is posted');
  assert(legalRoutes(state).some((route) => !sim.wouldDeadhead(state, route)), 'contract two opens with a fee-eligible legal route');
  pass('Contract repeat history resets between contracts and seed 810001 opens contract two fairly.');
}

function testProtectedStarterFeeEligibility() {
  let sampled = 0;
  let expressOnlyOpenings = 0;
  for (let seed = 1; seed <= 5000; seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      const protectedRoute = legalRoutes(state).find((route) => state.routeStates[route.id].tutorialProtected);
      assert(Boolean(protectedRoute), `seed ${seed} ${office.id} has a protected starter`);
      assert(!sim.wouldDeadhead(state, protectedRoute), `protected starter is fee-eligible for seed ${seed} ${office.id}`);
      const standardEligible = legalRoutes(state).some((route) => !route.express && !sim.wouldDeadhead(state, route));
      const anyEligible = legalRoutes(state).some((route) => !sim.wouldDeadhead(state, route));
      assert(anyEligible, `seed ${seed} ${office.id} has at least one fee-eligible route`);
      if (!standardEligible) {
        expressOnlyOpenings += 1;
      }
      sampled += 1;
    }
  }
  pass(`Protected starter fee eligibility sampled ${sampled} openings; express-only valid openings observed: ${expressOnlyOpenings}.`);
}

function testNegativeIntelNoSideChannel() {
  let scoutOfficialOnly = 0;
  let telegraphPhysicalOnly = 0;
  let cleanScout = 0;
  let cleanTelegraph = 0;
  for (let seed = 1; seed <= 12000 && (scoutOfficialOnly < 80 || telegraphPhysicalOnly < 80 || cleanScout < 20 || cleanTelegraph < 20); seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      for (const route of legalRoutes(state)) {
        const hazards = routeHazards(state.routeStates[route.id]);
        const physical = hazards.filter((id) => physicalHazards.has(id));
        const official = hazards.filter((id) => officialHazards.has(id));
        if (!hazards.length && cleanScout < 20) {
          const scouted = sim.applyPrepAction(state, route.id, 'scout');
          assert(reportFor(scouted.routeStates[route.id], 'scout')?.text === 'Scout: physical trail looks clear.', 'Scout clean negative report text is stable');
          cleanScout += 1;
        }
        if (!hazards.length && cleanTelegraph < 20) {
          const wired = sim.applyPrepAction(state, route.id, 'telegraph');
          assert(reportFor(wired.routeStates[route.id], 'telegraph')?.text === 'Wire: no official warning posted.', 'Telegraph clean negative report text is stable');
          cleanTelegraph += 1;
        }
        if (official.length && !physical.length && scoutOfficialOnly < 80) {
          const scouted = sim.applyPrepAction(state, route.id, 'scout');
          assert(reportFor(scouted.routeStates[route.id], 'scout')?.text === 'Scout: physical trail looks clear.', 'Scout official-only negative report matches clean wording');
          scoutOfficialOnly += 1;
        }
        if (physical.length && !official.length && telegraphPhysicalOnly < 80) {
          const wired = sim.applyPrepAction(state, route.id, 'telegraph');
          assert(reportFor(wired.routeStates[route.id], 'telegraph')?.text === 'Wire: no official warning posted.', 'Telegraph physical-only negative report matches clean wording');
          telegraphPhysicalOnly += 1;
        }
      }
    }
  }
  assert(scoutOfficialOnly > 0 && telegraphPhysicalOnly > 0, 'sampled opposite-source hidden hazard cases');
  pass(`Negative intel side-channel checks sampled ${scoutOfficialOnly} Scout and ${telegraphPhysicalOnly} Telegraph opposite-source cases.`);
}

function testMixedExpressCounterOutcome() {
  const route = sim.routes.find((item) => item.express && [item.from, item.to].includes('san-antonio') && [item.from, item.to].includes('new-orleans'));
  assert(Boolean(route), 'San Antonio-New Orleans express route exists');
  for (let seed = 1; seed <= 100000; seed += 1) {
    const base = sim.startSeededRun(seed, 'new-orleans');
    const state = withRouteState(
      {
        ...base,
        currentNodeId: route.from,
        previousNodeId: undefined,
        contract: {
          ...base.contract,
          destination: route.to,
          legsRemaining: 3
        },
        segmentHistory: {}
      },
      route,
      {
        hazardId: 'ambush',
        hazardIds: ['ambush', 'inside-leak'],
        assigned: ['decoy'],
        intelReports: [],
        revealed: false
      }
    );
    const after = sim.resolveDispatch(state, route.id);
    const result = after.lastResult;
    if (!result.success && result.countersSucceeded.includes('decoy') && result.countersFailed.includes('decoy')) {
      pass(`Mixed express counter outcome preserved for seed ${seed}.`);
      return;
    }
  }
  throw new Error('Could not find mixed express decoy success/failure outcome.');
}

function testRumorAccuracyClassification() {
  const base = sim.startSeededRun(77, 'st-louis');
  const route = legalRoutes(base)[0];
  const state = forceCleanRoute(
    {
      ...base,
      stationRumor: {
        available: true,
        used: false,
        notice: 'A station porter offers a partial rumor.',
        reliability: 0.28,
        quality: 'partial',
        suggestedHazardId: 'rival-sabotage'
      }
    },
    route
  );
  const tipped = sim.applyPrepAction(state, route.id, 'tip');
  const after = sim.resolveDispatch(tipped, route.id);
  assert(after.lastResult?.localRumorOutcome === 'false', 'wrong partial rumor on clean route is classified false');
  pass('Partial/rumor outcome classification is based on factual route match.');
}

function testSettlementTruth() {
  const pressureBase = sim.startSeededRun(91, 'new-york');
  const pressureRoute = legalRoutes(pressureBase)[0];
  const pressureState = forceCleanRoute({ ...pressureBase, outlawPressure: 95 }, pressureRoute);
  const pressureAfter = sim.resolveDispatch(pressureState, pressureRoute.id);
  assert(pressureAfter.lastResult.pressureDelta === pressureAfter.outlawPressure - pressureState.outlawPressure, 'Outlaw Pressure delta is actual final minus initial');

  const route = legalRoutes(pressureBase).find((item) => item.baseRisk >= 0.25) ?? legalRoutes(pressureBase)[0];
  for (let seed = 1; seed <= 1000; seed += 1) {
    const base = sim.startSeededRun(seed, 'new-york');
    const insuredState = withRouteState(
      {
        ...base,
        currentNodeId: route.from,
        reputation: 1,
        outlawPressure: 95,
        contract: {
          ...base.contract,
          destination: route.to,
          cargoValue: 1089,
          legsRemaining: 3
        },
        segmentHistory: {}
      },
      route,
      {
        hazardId: 'ambush',
        hazardIds: ['ambush'],
        assigned: ['insurance'],
        intelReports: [],
        revealed: false
      }
    );
    const after = sim.resolveDispatch(insuredState, route.id);
    const result = after.lastResult;
    if (!result.success) {
      const multiplier = 1 + route.baseRisk * 0.8;
      const expected = Math.round(result.contract.cargoValue * 0.5 * multiplier) - Math.round(result.contract.cargoValue * 0.2 * multiplier);
      assert(result.insuranceMitigation === expected, 'Insurance mitigation includes route-risk multiplier');
      pass('Pressure delta and exact insurance mitigation verified.');
      return;
    }
  }
  throw new Error('Could not find insured failure case for mitigation check.');
}

testContractHistoryReset();
testProtectedStarterFeeEligibility();
testNegativeIntelNoSideChannel();
testMixedExpressCounterOutcome();
testRumorAccuracyClassification();
testSettlementTruth();

console.log('# Review10 regression checks');
for (const item of passes) {
  console.log(`PASS: ${item}`);
}
