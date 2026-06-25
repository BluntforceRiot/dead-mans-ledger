import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'review12-regression');

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

function testResultPhaseLock() {
  const base = sim.startSeededRun(1201, 'st-louis');
  const route = legalRoutes(base)[0];
  const resultState = sim.resolveDispatch(forceRoute(base, route, ['clean']), route.id);
  assert(Boolean(resultState.lastResult), 'setup produced an open result card state');
  const nextRoute = legalRoutes(resultState)[0] ?? route;
  const locked = {
    ...resultState,
    selectedRouteId: nextRoute.id
  };

  assert(sim.canDispatch(locked) === false, 'canDispatch is false while a result card is open');
  assert(sim.borrowCredit(locked) === locked, 'borrowCredit is a no-op while a result card is open');
  const lockedWithDebt = { ...locked, borrowedCredit: 300, cash: 1000 };
  assert(sim.repayDebt(lockedWithDebt) === lockedWithDebt, 'repayDebt is a no-op while a result card is open');
  assert(sim.applyPrepAction(locked, nextRoute.id, 'repair') === locked, 'applyPrepAction is a no-op while a result card is open');
  assert(sim.resolveDispatch(locked, nextRoute.id) === locked, 'resolveDispatch is a no-op while a result card is open');

  pass('Open result card phase blocks dispatch, prep, borrowing, repayment, and direct dispatch resolution.');
}

function testFiredPhaseLock() {
  const base = sim.startSeededRun(2202, 'new-york');
  const route = legalRoutes(base)[0];
  const fired = {
    ...base,
    selectedRouteId: route.id,
    cash: -1030,
    firedReason: 'Cash fell below the board debt limit.'
  };

  assert(sim.canDispatch(fired) === false, 'canDispatch is false after a firing result');
  assert(sim.borrowCredit(fired) === fired, 'borrowCredit is a no-op after firing');
  const firedWithDebt = { ...fired, borrowedCredit: 300, cash: 1000 };
  assert(sim.repayDebt(firedWithDebt) === firedWithDebt, 'repayDebt is a no-op after firing');
  assert(sim.applyPrepAction(fired, route.id, 'guards') === fired, 'applyPrepAction is a no-op after firing');
  assert(sim.resolveDispatch(fired, route.id) === fired, 'resolveDispatch is a no-op after firing');

  pass('Fired phase blocks dispatch, prep, borrowing, repayment, and direct dispatch resolution.');
}

function testGenericCounterAmbushHeadline() {
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
          destination: 'san-francisco',
          legsRemaining: 4
        },
        segmentHistory: {}
      },
      route,
      ['ambush'],
      {
        assigned: ['decoy']
      }
    );
    const after = sim.resolveDispatch(state, route.id);
    const result = after.lastResult;
    if (result.success && result.countered && result.hazard.id === 'ambush') {
      const headline = ledgerWire.buildLedgerHeadline(result);
      assert(headline.startsWith('COUNTER BREAKS AMBUSH'), 'ambush counter headline uses generic counter wording');
      assert(!headline.startsWith('GUARDS BREAK AMBUSH'), 'ambush counter headline does not miscredit guards');
      pass(`Generic ambush counter headline verified at seed ${seed}.`);
      return;
    }
  }
  throw new Error('Could not find successful decoy ambush counter case.');
}

testResultPhaseLock();
testFiredPhaseLock();
testGenericCounterAmbushHeadline();

console.log('# Review12 regression checks');
for (const item of passes) {
  console.log(`PASS: ${item}`);
}
