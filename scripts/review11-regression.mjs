import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'review11-regression');

async function buildEntry(entry, fileName) {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    build: {
      ssr: path.join(root, 'src', 'game', entry),
      outDir: path.join(outDir, fileName),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          format: 'es',
          entryFileNames: `${fileName}.mjs`
        }
      }
    }
  });
  return import(pathToFileURL(path.join(outDir, fileName, `${fileName}.mjs`)).href);
}

const sim = await buildEntry('sim.ts', 'sim');
const ledgerWire = await buildEntry('ledgerWire.ts', 'ledgerWire');
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

function forceRoute(state, route, hazardIds, extra = {}) {
  return withRouteState(state, route, {
    hazardId: hazardIds[0] ?? 'clean',
    hazardIds,
    assigned: [],
    intelReports: [],
    revealed: false,
    ...extra
  });
}

function testProtectedExpressCardinality() {
  let sampled = 0;
  let protectedExpress = 0;
  for (let seed = 1; seed <= 5000; seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      const protectedRoute = legalRoutes(state).find((route) => state.routeStates[route.id].tutorialProtected);
      assert(Boolean(protectedRoute), `seed ${seed} ${office.id} has a protected starter route`);
      const routeState = state.routeStates[protectedRoute.id];
      const expectedExposure = sim.incidentExposure(protectedRoute);
      assert(routeState.hazardIds.length === expectedExposure, `protected ${protectedRoute.id} stores ${expectedExposure} clean checks`);
      const after = sim.resolveDispatch(state, protectedRoute.id);
      assert(after.lastResult.incidents.length === expectedExposure, `protected ${protectedRoute.id} resolves ${expectedExposure} checks`);
      if (protectedRoute.express) {
        protectedExpress += 1;
      }
      sampled += 1;
    }
  }
  assert(protectedExpress > 0, 'sample includes protected express starters');
  pass(`Protected starter exposure cardinality sampled ${sampled} openings with ${protectedExpress} protected express starters.`);
}

function testDispatchStateIsFrozen() {
  const base = sim.startSeededRun(1, 'st-louis');
  const route = legalRoutes(base)[0];
  const locked = {
    ...base,
    selectedRouteId: route.id,
    dispatchingRouteId: route.id
  };
  assert(sim.borrowCredit(locked) === locked, 'borrowCredit is a no-op during committed dispatch');

  const lockedWithDebt = { ...locked, borrowedCredit: 300, cash: 1000 };
  assert(sim.repayDebt(lockedWithDebt) === lockedWithDebt, 'repayDebt is a no-op during committed dispatch');

  const beforeAssignments = locked.routeStates[route.id].assigned.length;
  const prepped = sim.applyPrepAction(locked, route.id, 'repair');
  assert(prepped === locked, 'applyPrepAction returns the same state during committed dispatch');
  assert(prepped.routeStates[route.id].assigned.length === beforeAssignments, 'dispatch lock prevents late prep assignment');
  pass('Dispatch phase freezes preparation, borrowing, and debt repayment at the simulation boundary.');
}

function testMixedExpressAggregateTruth() {
  const route = sim.routes.find((item) => item.express && [item.from, item.to].includes('san-antonio') && [item.from, item.to].includes('new-orleans'));
  assert(Boolean(route), 'San Antonio-New Orleans express route exists');
  for (let seed = 1; seed <= 100000; seed += 1) {
    const base = sim.startSeededRun(seed, 'new-orleans');
    const state = forceRoute(
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
      ['bad-weather', 'inside-leak'],
      {
        assigned: ['delay', 'decoy']
      }
    );
    const after = sim.resolveDispatch(state, route.id);
    const result = after.lastResult;
    const failed = result.incidents.find((incident) => !incident.success && incident.hazard.id !== 'clean');
    if (!result.success && failed && result.countersSucceeded.length > 0 && result.countersFailed.length > 0) {
      assert(result.hazard.id === failed.hazard.id, 'aggregate hazard is the first failed non-clean incident');
      assert(result.countered === false, 'overall failed mixed result is not stamped as countered');
      pass(`Mixed express aggregate cause and counter flag verified at seed ${seed}.`);
      return;
    }
  }
  throw new Error('Could not find mixed express worked/failed counter outcome.');
}

function testFalseRumorHeadlineNamesRealLoss() {
  const route = sim.routes.find((item) => [item.from, item.to].includes('new-york') && [item.from, item.to].includes('boston'));
  assert(Boolean(route), 'New York-Boston route exists');
  for (let seed = 1; seed <= 5000; seed += 1) {
    const base = sim.startSeededRun(seed, 'new-york');
    const state = forceRoute(
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
      ['inside-leak'],
      {
        intelReports: [
          {
            source: 'tip',
            quality: 'false',
            hazardId: 'telegraph-cut',
            confidence: 0.16,
            text: 'Tip: maybe Telegraph Cut.'
          }
        ]
      }
    );
    const after = sim.resolveDispatch(state, route.id);
    const result = after.lastResult;
    if (!result.success && result.localRumorOutcome === 'false') {
      const headline = ledgerWire.buildLedgerHeadline(result);
      assert(!headline.includes('EMPTY COUNTRY'), 'false rumor headline does not claim empty country when a real incident broke through');
      assert(headline.includes('INSIDE LEAK'), 'false rumor headline names the real failed incident');
      pass(`False-rumor headline names the real loss at seed ${seed}.`);
      return;
    }
  }
  throw new Error('Could not find false-rumor inside-leak failure case.');
}

function testSettlementDeadlineAndDebtTruth() {
  const base = sim.startSeededRun(31, 'new-york');
  const route = legalRoutes(base)[0];
  const deadlineState = forceRoute(
    {
      ...base,
      contract: {
        ...base.contract,
        destination: 'san-francisco',
        legsRemaining: 1
      }
    },
    route,
    ['clean']
  );
  const deadlineAfter = sim.resolveDispatch(deadlineState, route.id);
  const deadlineResult = deadlineAfter.lastResult;
  assert(deadlineResult.deadlinePenalty === Math.round(deadlineResult.contract.cargoValue * 0.22), 'deadline penalty is stored explicitly');
  assert(
    deadlineResult.cashDelta === deadlineResult.netFee - deadlineResult.deadheadPenalty - deadlineResult.deadlinePenalty,
    'successful expired contract cash delta reconciles from visible settlement rows'
  );

  const debtBase = sim.startSeededRun(44, 'st-louis');
  const borrowed = sim.borrowCredit(debtBase);
  const debtRoute = legalRoutes(borrowed)[0];
  const firstLeg = sim.resolveDispatch(
    forceRoute(
      {
        ...borrowed,
        contract: {
          ...borrowed.contract,
          destination: 'san-francisco',
          legsRemaining: 5
        }
      },
      debtRoute,
      ['clean']
    ),
    debtRoute.id
  );
  const firstResult = firstLeg.lastResult;
  assert(firstResult.borrowedThisLeg > 0, 'new borrowing is recorded on the leg where it happened');
  assert(firstResult.debtBefore === borrowed.borrowedCredit, 'debtBefore records the committed dispatch balance');
  assert(firstResult.debtAfter === firstLeg.borrowedCredit, 'debtAfter records the authoritative post-dispatch balance');

  const firstLegContinued = { ...firstLeg, lastResult: undefined };
  const secondRoute = legalRoutes(firstLegContinued)[0];
  const secondLeg = sim.resolveDispatch(forceRoute(firstLegContinued, secondRoute, ['clean']), secondRoute.id);
  const secondResult = secondLeg.lastResult;
  assert(secondResult.borrowedThisLeg === 0, 'carried debt is not labeled as newly borrowed on later legs');
  assert(secondResult.debtBefore === firstLeg.borrowedCredit, 'later leg debtBefore shows carried balance separately');
  pass('Deadline penalty, debt before/after, and borrowed-this-leg settlement fields verified.');
}

testProtectedExpressCardinality();
testDispatchStateIsFrozen();
testMixedExpressAggregateTruth();
testFalseRumorHeadlineNamesRealLoss();
testSettlementDeadlineAndDebtTruth();

console.log('# Review11 regression checks');
for (const item of passes) {
  console.log(`PASS: ${item}`);
}
