import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'review9-regression');

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

function routeHazards(routeState) {
  return routeState.hazardIds.filter((id) => id !== 'clean');
}

function legalRoutes(state) {
  return sim.getLegalAdjacentRoutes(state);
}

function reportFor(routeState, source) {
  return routeState.intelReports.find((report) => report.source === source);
}

function forceCleanRoute(state, route) {
  return {
    ...state,
    routeStates: {
      ...state.routeStates,
      [route.id]: {
        ...state.routeStates[route.id],
        active: true,
        hazardId: 'clean',
        hazardIds: ['clean'],
        hazardsGenerated: true,
        assigned: [],
        intelReports: [],
        revealed: false
      }
    },
    selectedRouteId: route.id
  };
}

function assertActualDeltas(before, after, label) {
  const result = after.lastResult;
  assert(Boolean(result), `${label}: dispatch produced a result`);
  assert(result.cashDelta === after.cash - before.cash, `${label}: cash delta matches before/after state`);
  assert(result.scoreDelta === after.score - before.score, `${label}: score delta matches before/after state`);
  assert(result.reputationDelta === after.reputation - before.reputation, `${label}: reputation delta matches before/after state`);
  assert(result.trustDelta === after.trust - before.trust, `${label}: trust delta matches before/after state`);
}

function testFalseTipSecrecy() {
  let samples = 0;
  for (let seed = 1; seed <= 12000 && samples < 150; seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      if (!state.stationRumor.available || (state.stationRumor.quality !== 'false' && state.stationRumor.quality !== 'bait')) {
        continue;
      }
      for (const route of legalRoutes(state)) {
        const actualHazards = routeHazards(state.routeStates[route.id]);
        if (!actualHazards.length) {
          continue;
        }
        const tipped = sim.applyPrepAction(state, route.id, 'tip');
        const routeState = tipped.routeStates[route.id];
        const display = sim.describeHazardStack(routeState);
        const tip = reportFor(routeState, 'tip');
        assert(Boolean(tip), 'false/bait tip creates a visible intel report');
        for (const hazardId of actualHazards) {
          const name = sim.hazardById(hazardId).name;
          if (!tip.text.includes(name)) {
            assert(!display.includes(name), `false/bait tip did not reveal hidden actual hazard ${name}`);
          }
        }
        samples += 1;
        if (samples >= 150) {
          break;
        }
      }
    }
  }
  assert(samples > 0, `sampled false/bait tips with hidden hazards (${samples})`);
  pass(`False/bait tip secrecy sampled ${samples} hidden-hazard cases.`);
}

function testCrossSourceSecrecy() {
  let scoutSamples = 0;
  let telegraphSamples = 0;
  for (let seed = 1; seed <= 12000 && (scoutSamples < 80 || telegraphSamples < 80); seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      for (const route of legalRoutes(state)) {
        const hazards = routeHazards(state.routeStates[route.id]);
        if (!hazards.length) {
          continue;
        }
        const physical = hazards.filter((id) => physicalHazards.has(id));
        const official = hazards.filter((id) => officialHazards.has(id));
        if (official.length && !physical.length && scoutSamples < 80) {
          const scouted = sim.applyPrepAction(state, route.id, 'scout');
          const display = sim.describeHazardStack(scouted.routeStates[route.id]);
          for (const hazardId of official) {
            assert(!display.includes(sim.hazardById(hazardId).name), 'Scout did not expose official-only hidden danger');
          }
          scoutSamples += 1;
        }
        if (physical.length && !official.length && telegraphSamples < 80) {
          const wired = sim.applyPrepAction(state, route.id, 'telegraph');
          const display = sim.describeHazardStack(wired.routeStates[route.id]);
          for (const hazardId of physical) {
            assert(!display.includes(sim.hazardById(hazardId).name), 'Telegraph did not expose physical-only hidden danger');
          }
          telegraphSamples += 1;
        }
      }
    }
  }
  assert(scoutSamples > 0, `sampled Scout cross-source secrecy cases (${scoutSamples})`);
  assert(telegraphSamples > 0, `sampled Telegraph cross-source secrecy cases (${telegraphSamples})`);
  pass(`Cross-source secrecy sampled ${scoutSamples} Scout and ${telegraphSamples} Telegraph cases.`);
}

function testExpressSecondSlotIntel() {
  let physicalSamples = 0;
  let officialSamples = 0;
  for (let seed = 1; seed <= 16000 && (physicalSamples < 40 || officialSamples < 40); seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      for (const route of legalRoutes(state).filter((item) => item.express)) {
        const hazardIds = state.routeStates[route.id].hazardIds;
        if (hazardIds[0] !== 'clean') {
          continue;
        }
        const secondPhysical = hazardIds.slice(1).find((id) => physicalHazards.has(id));
        if (secondPhysical && physicalSamples < 40) {
          const scouted = sim.applyPrepAction(state, route.id, 'scout');
          const report = reportFor(scouted.routeStates[route.id], 'scout');
          assert(report?.hazardId === secondPhysical, 'Scout reports a physical hazard in the second express exposure slot');
          physicalSamples += 1;
        }
        const secondOfficial = hazardIds.slice(1).find((id) => officialHazards.has(id));
        if (secondOfficial && officialSamples < 40) {
          const wired = sim.applyPrepAction(state, route.id, 'telegraph');
          const report = reportFor(wired.routeStates[route.id], 'telegraph');
          assert(report?.hazardId === secondOfficial, 'Telegraph reports an official hazard in the second express exposure slot');
          officialSamples += 1;
        }
      }
    }
  }
  assert(physicalSamples > 0, `sampled second-slot express Scout hazards (${physicalSamples})`);
  assert(officialSamples > 0, `sampled second-slot express Telegraph hazards (${officialSamples})`);
  pass(`Express second-slot intel sampled ${physicalSamples} Scout and ${officialSamples} Telegraph cases.`);
}

function testOpeningProgressRoutes() {
  let sampled = 0;
  for (let seed = 1; seed <= 5000; seed += 1) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      const feeEligible = legalRoutes(state).filter((route) => !sim.wouldDeadhead(state, route));
      assert(feeEligible.length > 0, `opening seed ${seed} ${office.id} has a fee-eligible legal route`);
      sampled += 1;
    }
  }

  const sanFrancisco31 = sim.startSeededRun(31, 'san-francisco');
  const protectedStarter = legalRoutes(sanFrancisco31).find((route) => sanFrancisco31.routeStates[route.id].tutorialProtected);
  assert(Boolean(protectedStarter), 'seed 31 San Francisco exposes a board-cleared starter route');
  assert(!sim.wouldDeadhead(sanFrancisco31, protectedStarter), 'seed 31 board-cleared starter route is fee-eligible');
  assert(sampled === 5000 * sim.dispatchOffices.length, `sampled opening progress routes (${sampled})`);
  pass(`Opening progress sampled ${sampled} contracts and seed 31 San Francisco.`);
}

function testDeadheadSharedTruthAndDeltas() {
  const destinationBase = sim.startSeededRun(222, 'new-orleans');
  const destinationRoute = legalRoutes(destinationBase)[0];
  const destinationNode = sim.otherEnd(destinationRoute, destinationBase.currentNodeId);
  const destinationState = forceCleanRoute(
    {
      ...destinationBase,
      previousNodeId: destinationNode,
      contract: {
        ...destinationBase.contract,
        destination: destinationNode,
        legsRemaining: Math.max(2, destinationBase.contract.legsRemaining)
      },
      segmentHistory: {
        [sim.segmentKey(destinationRoute)]: 1
      }
    },
    destinationRoute
  );
  assert(!sim.wouldDeadhead(destinationState, destinationRoute), 'shared deadhead helper exempts a repeated destination leg');
  const delivered = sim.resolveDispatch(destinationState, destinationRoute.id);
  assert(delivered.lastResult.arrivedAtDestination, 'forced clean repeated route reaches destination');
  assert(!delivered.lastResult.deadheadRun, 'dispatch result records no deadhead on destination delivery');
  assert(delivered.lastResult.grossFee > 0, 'destination delivery still earns a route fee');
  assertActualDeltas(destinationState, delivered, 'destination exemption');

  const deadheadBase = sim.startSeededRun(31, 'san-francisco');
  const deadheadRoute = legalRoutes(deadheadBase).find((route) => sim.otherEnd(route, deadheadBase.currentNodeId) !== deadheadBase.contract.destination) ?? legalRoutes(deadheadBase)[0];
  const deadheadNextNode = sim.otherEnd(deadheadRoute, deadheadBase.currentNodeId);
  const nonDestination = sim.nodes.find((node) => node.id !== deadheadBase.currentNodeId && node.id !== deadheadNextNode)?.id ?? deadheadBase.contract.destination;
  const deadheadState = forceCleanRoute(
    {
      ...deadheadBase,
      score: 0,
      contract: {
        ...deadheadBase.contract,
        destination: nonDestination,
        legsRemaining: Math.max(2, deadheadBase.contract.legsRemaining)
      },
      segmentHistory: {
        [sim.segmentKey(deadheadRoute)]: 1
      }
    },
    deadheadRoute
  );
  assert(sim.wouldDeadhead(deadheadState, deadheadRoute), 'shared deadhead helper flags repeated non-destination travel');
  const deadheaded = sim.resolveDispatch(deadheadState, deadheadRoute.id);
  assert(deadheaded.lastResult.deadheadRun, 'dispatch result records deadhead travel');
  assert(deadheaded.lastResult.deadheadPenalty > 0, 'dispatch result records the exact deadhead operating charge');
  assertActualDeltas(deadheadState, deadheaded, 'deadhead clamp');
  pass('Shared deadhead helper, destination exemption, deadhead charge, and actual deltas verified.');
}

testFalseTipSecrecy();
testCrossSourceSecrecy();
testExpressSecondSlotIntel();
testOpeningProgressRoutes();
testDeadheadSharedTruthAndDeltas();

console.log('# Review9 regression checks');
for (const item of passes) {
  console.log(`PASS: ${item}`);
}
