import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'route-integrity-v071-sim');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const versionLabel = `v${packageJson.version}`;
const versionTag = `V${packageJson.version.replace(/\./g, '')}`;
const reportPath = path.join(root, `ROUTE_GENERATION_INTEGRITY_REPORT_${versionTag}.md`);
const contractsPerOfficeJourney = 5000;
const journeys = [1, 5, 10];

const findings = [];
const passes = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  findings.push(message);
}

function assert(condition, message) {
  if (condition) {
    pass(message);
  } else {
    fail(message);
  }
}

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pressureFor(office, journey) {
  return clamp(20 + office.pressureBonus + (journey - 1) * 5, 0, 95);
}

function hasActivePath(routeStates, from, to) {
  const queue = [from];
  const visited = new Set([from]);
  while (queue.length) {
    const nodeId = queue.shift();
    for (const route of sim.getAdjacentRoutes(nodeId, routeStates)) {
      const nextNode = sim.otherEnd(route, nodeId);
      if (nextNode === to) {
        return true;
      }
      if (!visited.has(nextNode)) {
        visited.add(nextNode);
        queue.push(nextNode);
      }
    }
  }
  return false;
}

function cloneRouteStates(routeStates) {
  return Object.fromEntries(
    Object.entries(routeStates).map(([routeId, routeState]) => [
      routeId,
      {
        ...routeState,
        hazardIds: [...routeState.hazardIds],
        assigned: [...routeState.assigned],
        intelReports: [...routeState.intelReports]
      }
    ])
  );
}

function countRuntimeContinuationGaps(routeStates, contract) {
  let gaps = 0;
  const activeRoutes = sim.routes.filter((route) => routeStates[route.id]?.active);
  for (const route of activeRoutes) {
    for (const [previousNode, arrivalNode] of [
      [route.from, route.to],
      [route.to, route.from]
    ]) {
      if (arrivalNode === contract.destination) {
        continue;
      }
      const repairedStates = cloneRouteStates(routeStates);
      sim.ensureAdjacentRoute(repairedStates, arrivalNode, previousNode);
      const forward = sim.getAdjacentRoutes(arrivalNode, repairedStates).filter((candidate) => sim.otherEnd(candidate, arrivalNode) !== previousNode);
      if (forward.length === 0) {
        gaps += 1;
      }
    }
  }
  return gaps;
}

function verifyRouteGraph() {
  const nodeIds = new Set(sim.nodes.map((node) => node.id));
  const endpointPairs = new Map();
  for (const route of sim.routes) {
    if (!nodeIds.has(route.from) || !nodeIds.has(route.to)) {
      fail(`Route ${route.id} references unknown endpoint ${route.from} -> ${route.to}.`);
    }
    const key = [route.from, route.to].sort().join('::');
    const existing = endpointPairs.get(key);
    if (existing) {
      fail(`Duplicate undirected route endpoints ${key}: ${existing} and ${route.id}.`);
    }
    endpointPairs.set(key, route.id);
  }

  const start = sim.nodes[0]?.id;
  const connected = new Set(start ? [start] : []);
  const queue = start ? [start] : [];
  while (queue.length) {
    const nodeId = queue.shift();
    for (const route of sim.getAdjacentRoutes(nodeId)) {
      const nextNode = sim.otherEnd(route, nodeId);
      if (!connected.has(nextNode)) {
        connected.add(nextNode);
        queue.push(nextNode);
      }
    }
  }
  const isolated = sim.nodes.filter((node) => !connected.has(node.id));
  if (isolated.length) {
    fail(`Route graph has isolated nodes: ${isolated.map((node) => node.id).join(', ')}.`);
  }
}

function countAdjacencyProbeActivations() {
  let activations = 0;
  for (const office of sim.dispatchOffices) {
    const routeStates = sim.generateRouteStates(91071 + office.id.length * 8191, 8, office.nodeId, undefined, 90);
    for (const routeState of Object.values(routeStates)) {
      routeState.active = false;
      routeState.activatedInitially = false;
      routeState.activatedForDestination = false;
      routeState.activatedForAdjacency = false;
    }
    sim.ensureAdjacentRoute(routeStates, office.nodeId);
    activations += Object.values(routeStates).filter((routeState) => routeState.activatedForAdjacency).length;
  }
  return activations;
}

verifyRouteGraph();
const adjacencyProbeActivations = countAdjacencyProbeActivations();

function createBucket(label) {
  return {
    label,
    contracts: 0,
    contractsWithConnectivity: 0,
    destinationActivatedRoutes: 0,
    adjacencyActivatedRoutes: 0,
    connectivityRoutes: 0,
    connectivityCleanRoutes: 0,
    connectivityIncidentRoutes: 0,
    allMeasuredRoutes: 0,
    allIncidentRoutes: 0,
    displayedRiskSum: 0,
    tutorialProtectedRoutes: 0,
    missingDestinationPaths: 0,
    missingLegalExits: 0,
    missingContinuationExits: 0,
    missingFeeEligibleOpeningRoutes: 0,
    deadheadProtectedStarters: 0,
    falseRumorExactMatches: 0,
    activeWithoutGeneratedHazards: 0,
    nonTutorialProtectedCleanGuarantees: 0
  };
}

function addBucket(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number') {
      target[key] += value;
    }
  }
}

const overall = createBucket('Overall');
const journeyBuckets = new Map(journeys.map((journey) => [journey, createBucket(`Journey ${journey}`)]));
const officeBuckets = new Map(sim.dispatchOffices.map((office) => [office.id, createBucket(office.name)]));
const rows = [];

let seedBase = 71071;

for (const office of sim.dispatchOffices) {
  for (const journey of journeys) {
    const bucket = createBucket(`${office.name} / Journey ${journey}`);
    for (let index = 0; index < contractsPerOfficeJourney; index += 1) {
      const seed = (seedBase + index * 131 + journey * 104729 + office.id.length * 8191) >>> 0;
      const pressure = pressureFor(office, journey);
      const contract = sim.generateContract(seed, journey, office.nodeId);
      const routeStates = sim.generateRouteStates(seed, journey, office.nodeId, contract, pressure);
      const activeRoutes = sim.routes.filter((route) => routeStates[route.id]?.active);
      const connectivityRoutes = activeRoutes.filter((route) => {
        const routeState = routeStates[route.id];
        return routeState.activatedForDestination || routeState.activatedForAdjacency;
      });

      bucket.contracts += 1;
      if (connectivityRoutes.length > 0) {
        bucket.contractsWithConnectivity += 1;
      }
      if (!hasActivePath(routeStates, contract.origin, contract.destination)) {
        bucket.missingDestinationPaths += 1;
      }
      if (sim.getAdjacentRoutes(office.nodeId, routeStates).length === 0) {
        bucket.missingLegalExits += 1;
      }
      const openingState = {
        currentNodeId: office.nodeId,
        previousNodeId: undefined,
        contract,
        routeStates,
        segmentHistory: {}
      };
      const feeEligibleOpeningRoutes = sim.getAdjacentRoutes(office.nodeId, routeStates).filter((route) => !sim.wouldDeadhead(openingState, route));
      if (contract.destination !== office.nodeId && feeEligibleOpeningRoutes.length === 0) {
        bucket.missingFeeEligibleOpeningRoutes += 1;
      }
      bucket.missingContinuationExits += countRuntimeContinuationGaps(routeStates, contract);
      const rumor = sim.generateStationRumor(seed, journey, 1, office.nodeId, routeStates);
      if ((rumor.quality === 'false' || rumor.quality === 'bait') && rumor.suggestedHazardId) {
        const adjacentHazards = new Set(
          sim
            .getAdjacentRoutes(office.nodeId, routeStates)
            .flatMap((route) => routeStates[route.id].hazardIds)
            .filter((hazardId) => hazardId !== 'clean')
        );
        if (adjacentHazards.has(rumor.suggestedHazardId)) {
          bucket.falseRumorExactMatches += 1;
        }
      }

      const protectedRoutes = activeRoutes.filter((route) => routeStates[route.id].tutorialProtected);
      bucket.tutorialProtectedRoutes += protectedRoutes.length;
      if (journey === 1 && protectedRoutes.length !== 1) {
        fail(`Expected exactly one tutorial-protected route for ${office.id} seed ${seed}; saw ${protectedRoutes.length}.`);
      }
      if (journey === 1 && protectedRoutes.some((route) => sim.wouldDeadhead(openingState, route))) {
        bucket.deadheadProtectedStarters += 1;
      }
      if (journey !== 1 && protectedRoutes.length !== 0) {
        fail(`Unexpected tutorial-protected route for journey ${journey}, ${office.id}, seed ${seed}.`);
      }

      for (const route of activeRoutes) {
        const routeState = routeStates[route.id];
        if (!routeState.hazardsGenerated) {
          bucket.activeWithoutGeneratedHazards += 1;
        }
        if (routeState.tutorialProtected && !routeState.hazardIds.every((id) => id === 'clean')) {
          fail(`Tutorial-protected route was not clean: ${route.id}, ${office.id}, seed ${seed}.`);
        }
        if (!routeState.tutorialProtected) {
          bucket.allMeasuredRoutes += 1;
          bucket.displayedRiskSum += sim.estimateRouteIncidentProbability(route, journey, pressure).probability;
          if (routeState.hazardIds.some((id) => id !== 'clean')) {
            bucket.allIncidentRoutes += 1;
          }
        }
      }

      for (const route of connectivityRoutes) {
        const routeState = routeStates[route.id];
        if (routeState.activatedForDestination) {
          bucket.destinationActivatedRoutes += 1;
        }
        if (routeState.activatedForAdjacency) {
          bucket.adjacencyActivatedRoutes += 1;
        }
        if (!routeState.tutorialProtected) {
          bucket.connectivityRoutes += 1;
          if (routeState.hazardIds.every((id) => id === 'clean')) {
            bucket.connectivityCleanRoutes += 1;
          } else {
            bucket.connectivityIncidentRoutes += 1;
          }
        }
      }

      const cleanConnectivity = connectivityRoutes.filter((route) => {
        const routeState = routeStates[route.id];
        return !routeState.tutorialProtected && routeState.hazardIds.every((id) => id === 'clean');
      });
      if (cleanConnectivity.length === connectivityRoutes.filter((route) => !routeStates[route.id].tutorialProtected).length && cleanConnectivity.length > 0) {
        bucket.nonTutorialProtectedCleanGuarantees += 1;
      }
    }

    addBucket(overall, bucket);
    addBucket(journeyBuckets.get(journey), bucket);
    addBucket(officeBuckets.get(office.id), bucket);
    rows.push(bucket);
    seedBase += 170003;
  }
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function summarize(bucket) {
  const empiricalIncidentRate = bucket.allMeasuredRoutes ? bucket.allIncidentRoutes / bucket.allMeasuredRoutes : 0;
  const displayedRisk = bucket.allMeasuredRoutes ? bucket.displayedRiskSum / bucket.allMeasuredRoutes : 0;
  const connectivityCleanRate = bucket.connectivityRoutes ? bucket.connectivityCleanRoutes / bucket.connectivityRoutes : 0;
  return {
    ...bucket,
    empiricalIncidentRate,
    displayedRisk,
    connectivityCleanRate,
    riskDelta: Math.abs(empiricalIncidentRate - displayedRisk)
  };
}

const summary = summarize(overall);

assert(overall.contracts === contractsPerOfficeJourney * journeys.length * sim.dispatchOffices.length, 'Expected contract sample size generated.');
assert(overall.destinationActivatedRoutes > 0, 'Destination path activation occurred in sampled contracts.');
assert(adjacencyProbeActivations > 0, `Adjacency activation occurred in no-contract probe (${adjacencyProbeActivations} activations).`);
assert(overall.connectivityRoutes > 0, 'Connectivity-activated routes were measured.');
assert(summary.connectivityCleanRate < 0.98, `Connectivity-activated routes are not universally clean (${pct(summary.connectivityCleanRate)} clean).`);
assert(summary.empiricalIncidentRate > 0.1, `Empirical incident rate is nonzero (${pct(summary.empiricalIncidentRate)}).`);
assert(summary.riskDelta <= 0.12, `Empirical incident rate broadly matches displayed risk (${pct(summary.empiricalIncidentRate)} vs ${pct(summary.displayedRisk)}).`);
assert(overall.missingDestinationPaths === 0, 'Every generated contract has a valid active destination path.');
assert(overall.missingLegalExits === 0, 'Every current station has at least one legal exit.');
assert(overall.missingFeeEligibleOpeningRoutes === 0, 'Every sampled opening contract has at least one legal fee-eligible route toward the destination.');
assert(overall.deadheadProtectedStarters === 0, 'Every sampled tutorial-protected starter route is fee-eligible under shared deadhead classification.');
assert(overall.missingContinuationExits === 0, 'Every sampled active-route arrival has a non-backtracking continuation after runtime route repair.');
assert(overall.falseRumorExactMatches === 0, 'False and bait local rumors never exactly match an adjacent real hazard.');
assert(overall.activeWithoutGeneratedHazards === 0, 'Every active route has generated hazards or explicit tutorial protection.');
assert(overall.tutorialProtectedRoutes === contractsPerOfficeJourney * sim.dispatchOffices.length, 'Only first-journey contracts receive exactly one tutorial-protected route.');

const tableRows = rows.map((bucket) => {
  const item = summarize(bucket);
  return `| ${item.label} | ${item.contracts} | ${item.contractsWithConnectivity} | ${item.destinationActivatedRoutes} | ${item.adjacencyActivatedRoutes} | ${pct(item.connectivityCleanRate)} | ${pct(item.empiricalIncidentRate)} | ${pct(item.displayedRisk)} | ${item.tutorialProtectedRoutes} |`;
});

const journeyRows = [...journeyBuckets.values()].map((bucket) => {
  const item = summarize(bucket);
  return `| ${item.label} | ${item.contracts} | ${item.contractsWithConnectivity} | ${item.destinationActivatedRoutes} | ${item.adjacencyActivatedRoutes} | ${pct(item.connectivityCleanRate)} | ${pct(item.empiricalIncidentRate)} | ${pct(item.displayedRisk)} | ${item.tutorialProtectedRoutes} |`;
});

const officeRows = [...officeBuckets.values()].map((bucket) => {
  const item = summarize(bucket);
  return `| ${item.label} | ${item.contracts} | ${item.contractsWithConnectivity} | ${item.destinationActivatedRoutes} | ${item.adjacencyActivatedRoutes} | ${pct(item.connectivityCleanRate)} | ${pct(item.empiricalIncidentRate)} | ${pct(item.displayedRisk)} | ${item.tutorialProtectedRoutes} |`;
});

const report = `# Dead Man's Ledger ${versionLabel} Route Generation Integrity Report

## Summary

- Contracts tested: ${overall.contracts}
- Offices tested: ${sim.dispatchOffices.length}
- Journeys tested: ${journeys.join(', ')}
- Contracts per office/journey: ${contractsPerOfficeJourney}
- Contracts with connectivity-activated routes: ${overall.contractsWithConnectivity}
- Destination-activated routes: ${overall.destinationActivatedRoutes}
- Adjacency-activated routes: ${overall.adjacencyActivatedRoutes}
- Adjacency-only probe activations: ${adjacencyProbeActivations}
- Contracts missing a fee-eligible opening route: ${overall.missingFeeEligibleOpeningRoutes}
- Tutorial-protected starter deadheads: ${overall.deadheadProtectedStarters}
- Runtime-repaired active arrival continuation gaps: ${overall.missingContinuationExits}
- False/bait rumor exact hazard matches: ${overall.falseRumorExactMatches}
- Connectivity clean rate: ${pct(summary.connectivityCleanRate)}
- Empirical incident rate: ${pct(summary.empiricalIncidentRate)}
- Displayed estimated risk: ${pct(summary.displayedRisk)}
- Tutorial-protected route count: ${overall.tutorialProtectedRoutes}

## Acceptance Checks

${passes.map((item) => `- PASS: ${item}`).join('\n')}
${findings.length ? `\n## Findings\n\n${findings.map((item) => `- FAIL: ${item}`).join('\n')}` : '\n## Findings\n\n- None.'}

## Office/Journey Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${tableRows.join('\n')}

## Journey Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${journeyRows.join('\n')}

## Office Breakdown

| Bucket | Contracts | Contracts With Connectivity | Destination Activations | Adjacency Activations | Connectivity Clean Rate | Empirical Incident Rate | Displayed Risk | Tutorial Protected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${officeRows.join('\n')}
`;

await fs.writeFile(reportPath, report);
console.log(`Wrote ${reportPath}`);

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
