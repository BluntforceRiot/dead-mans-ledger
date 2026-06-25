import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'playtest-v061-sim');
const reportPath = path.join(root, 'PLAYTEST_REPORT_DEAD_MANS_LEDGER_V061.md');
const baseUrl = process.argv[2] ?? process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:4173/';

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
        entryFileNames: 'sim.mjs',
        chunkFileNames: 'chunk-[name].mjs'
      }
    }
  }
});

const sim = await import(pathToFileURL(path.join(outDir, 'sim.mjs')).href);
const demoUrl = 'https://bluntforceriot.github.io/dead-mans-ledger/';
const repoUrl = 'https://github.com/BluntforceRiot/dead-mans-ledger';

function routeWithHazard(state, hazardId, { express = false, clean = false } = {}) {
  return sim.getLegalAdjacentRoutes(state).find((route) => {
    const routeState = state.routeStates[route.id];
    if (express && !route.express) {
      return false;
    }
    if (clean) {
      return routeState.hazardIds.every((id) => id === 'clean');
    }
    return routeState.hazardIds.includes(hazardId);
  });
}

function bestRouteToward(state) {
  const legal = sim.getLegalAdjacentRoutes(state);
  const toward = legal.filter((route) => sim.routeClosesDistance(state, route));
  return [...(toward.length ? toward : legal)].sort((a, b) => Number(a.express) - Number(b.express) || a.baseRisk - b.baseRisk)[0];
}

function applyAllCounters(state, route) {
  for (const action of ['scout', 'telegraph', 'guards', 'repair', 'decoy', 'delay', 'insurance']) {
    state = sim.applyPrepAction(state, route.id, action);
  }
  return state;
}

function findScenario(label, test) {
  for (let seed = 1000; seed < 18000; seed += 37) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      const result = test(state, seed, office.id);
      if (result) {
        pass(`${label}: seed ${seed}, office ${office.id}`);
        return result;
      }
    }
  }
  fail(`${label}: not found in seeded search window`);
  return undefined;
}

function assertApprox(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message} (${actual.toFixed(4)} ~= ${expected.toFixed(4)})`);
}

function expectedIncidentCheck(route, journey, outlawPressure, exposureIndex = 0) {
  const pressureLift = outlawPressure / 100;
  const tutorialEase = journey === 1 ? -0.12 : 0;
  const hazardChance = Math.min(0.72, Math.max(0.08, 0.22 + journey * 0.018 + pressureLift * 0.22 + tutorialEase));
  return Math.min(0.86, Math.max(0.08, hazardChance + route.baseRisk * 0.42 + (route.express ? 0.12 : 0) + exposureIndex * 0.08));
}

function expectedIncidentProbability(route, journey, outlawPressure) {
  const perCheck = Array.from({ length: sim.incidentExposure(route) }, (_, index) => expectedIncidentCheck(route, journey, outlawPressure, index));
  return 1 - perCheck.reduce((safe, chance) => safe * (1 - chance), 1);
}

function dangerText(route, state) {
  const estimate = sim.estimateRouteIncidentProbability(route, state.journey, state.outlawPressure);
  const percent = Math.round(estimate.probability * 100);
  const prefix = state.journey === 1 && !route.express && percent <= 32 ? 'Tutorial ' : '';
  const suffix = route.express ? ' any incident' : '';
  return `${prefix}${percent}%${suffix}`;
}

function assertDangerModelCase(label, route, journey, outlawPressure) {
  const estimate = sim.estimateRouteIncidentProbability(route, journey, outlawPressure);
  const expected = expectedIncidentProbability(route, journey, outlawPressure);
  assertApprox(estimate.probability, expected, 0.0001, `Danger model matches route generation: ${label}`);
  for (const [index, chance] of estimate.perCheck.entries()) {
    assertApprox(chance, expectedIncidentCheck(route, journey, outlawPressure, index), 0.0001, `Per-check danger matches generation: ${label} check ${index + 1}`);
  }
}

const riskState = sim.startSeededRun(9000, 'new-york');
const riskNormalRoute = sim.getLegalAdjacentRoutes(riskState).find((route) => !route.express) ?? sim.getLegalAdjacentRoutes(riskState)[0];
const riskExpressRoute =
  sim.dispatchOffices
    .map((office) => sim.startSeededRun(1000, office.id))
    .flatMap((state) => sim.getLegalAdjacentRoutes(state))
    .find((route) => route.express) ?? riskNormalRoute;
assertDangerModelCase('Journey 1 low pressure normal route', riskNormalRoute, 1, 18);
assertDangerModelCase('Later journey medium pressure normal route', riskNormalRoute, 5, 48);
assertDangerModelCase('High pressure normal route', riskNormalRoute, 9, 90);
assertDangerModelCase('Express route any-incident probability', riskExpressRoute, 6, 55);
const mapSvg = await fs.readFile(path.join(root, 'public', 'assets', 'map', 'map-base-usa-4k.svg'), 'utf8');
assert(!mapSvg.includes('Open U.S. geography styled as a playable frontier route board.'), 'Generated map asset does not contain clipped caption text');
for (const requiredFile of ['.github/workflows/deploy.yml', '.gitignore', 'LICENSE']) {
  await fs.stat(path.join(root, requiredFile));
  pass(`Required deploy/package file exists: ${requiredFile}`);
}

const deliveredResult = findScenario('cautious full Contract 1 completion', (initial) => {
  let state = initial;
  for (let leg = 0; leg < 10; leg += 1) {
    const route = bestRouteToward(state);
    if (!route) {
      return undefined;
    }
    state = applyAllCounters(state, route);
    state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
    if (state.lastResult?.arrivedAtDestination) {
      return state.lastResult;
    }
    if (state.firedReason || state.lastResult?.contractEnded) {
      return undefined;
    }
  }
  return undefined;
});

findScenario('reckless express contract remains risky', (state) => {
  const route = routeWithHazard(state, 'ambush', { express: true }) ?? sim.getLegalAdjacentRoutes(state).find((item) => item.express);
  if (!route) {
    return undefined;
  }
  const resultState = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return resultState.lastResult && (!resultState.lastResult.success || route.express) ? resultState.lastResult : undefined;
});

findScenario('credit-funded contract keeps debt accounting', (state) => {
  state = sim.borrowCredit(state);
  const route = bestRouteToward(state);
  if (!route || state.borrowedCredit <= 0) {
    return undefined;
  }
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.debtUsed > 0 && state.lastResult.interestCharge > 0 ? state.lastResult : undefined;
});

findScenario('false local tip scenario', (state) => {
  if (!state.stationRumor.available || !['false', 'bait'].includes(state.stationRumor.quality)) {
    return undefined;
  }
  const route = bestRouteToward(state);
  if (!route) {
    return undefined;
  }
  state = sim.applyPrepAction(state, route.id, 'tip');
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.localRumorOutcome === 'false' ? state.lastResult : undefined;
});

const counterWorkedResult = findScenario('ambush countered by guards', (state) => {
  const route = routeWithHazard(state, 'ambush');
  if (!route) {
    return undefined;
  }
  state = sim.applyPrepAction(state, route.id, 'guards');
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.countersSucceeded.includes('guards') ? state.lastResult : undefined;
});

findScenario('track cut repaired', (state) => {
  const route = routeWithHazard(state, 'track-cut');
  if (!route) {
    return undefined;
  }
  state = sim.applyPrepAction(state, route.id, 'repair');
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.countersSucceeded.includes('repair') ? state.lastResult : undefined;
});

const cleanPassageResult = findScenario('clean passage with protection held in reserve', (state) => {
  const route = routeWithHazard(state, 'clean', { clean: true });
  if (!route) {
    return undefined;
  }
  state = sim.applyPrepAction(state, route.id, 'guards');
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.protectionHeld.includes('guards') ? state.lastResult : undefined;
});

findScenario('fired outcome', (initial) => {
  let state = initial;
  for (let leg = 0; leg < 60; leg += 1) {
    state = sim.borrowCredit(state);
    const route = sim.getLegalAdjacentRoutes(state).sort((a, b) => Number(b.express) - Number(a.express) || b.baseRisk - a.baseRisk)[0];
    if (!route) {
      return undefined;
    }
    state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
    if (state.firedReason) {
      return state.lastResult;
    }
  }
  return undefined;
});

const inTransitResult = findScenario('in-transit result status', (state) => {
  const route = sim.getLegalAdjacentRoutes(state).find((item) => {
    const routeState = state.routeStates[item.id];
    return routeState.hazardIds.some((hazardId) => hazardId !== 'clean') && sim.otherEnd(item, state.currentNodeId) !== state.contract.destination;
  });
  if (!route) {
    return undefined;
  }
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.success && !state.lastResult.countered && !state.lastResult.contractEnded ? state.lastResult : undefined;
});

const disruptedResult = findScenario('shipment disrupted result status', (state) => {
  const route = sim.getLegalAdjacentRoutes(state).find((item) => state.routeStates[item.id].hazardIds.some((hazardId) => hazardId !== 'clean'));
  if (!route) {
    return undefined;
  }
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult && !state.lastResult.success ? state.lastResult : undefined;
});

const expiredResult = findScenario('contract expired result status', (state) => {
  const route = routeWithHazard(state, 'clean', { clean: true });
  if (!route || sim.otherEnd(route, state.currentNodeId) === state.contract.destination) {
    return undefined;
  }
  state = {
    ...state,
    contract: {
      ...state.contract,
      legsRemaining: 1
    }
  };
  state = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
  return state.lastResult?.success && state.lastResult.contractEnded && !state.lastResult.arrivedAtDestination ? state.lastResult : undefined;
});

const statusCases = [
  [deliveredResult, 'DELIVERED'],
  [counterWorkedResult, 'COUNTER WORKED'],
  [cleanPassageResult, 'CLEAN PASSAGE'],
  [inTransitResult, 'IN TRANSIT'],
  [disruptedResult, 'SHIPMENT DISRUPTED'],
  [expiredResult, 'CONTRACT EXPIRED']
];
for (const [result, expected] of statusCases) {
  assert(Boolean(result) && sim.dispatchResultStatusLabel(result) === expected, `Result status label: ${expected}`);
}

const rumorSamples = Array.from({ length: 120 }, (_, index) => sim.startSeededRun(9000 + index * 41, sim.dispatchOffices[index % sim.dispatchOffices.length].id));
const rumorAvailable = rumorSamples.filter((state) => state.stationRumor.available).length;
assert(rumorAvailable > 25 && rumorAvailable < 65, `Local Tip availability is bounded (${rumorAvailable}/120 samples)`);
const repeatTipState = rumorSamples.find((state) => state.stationRumor.available);
if (repeatTipState) {
  const route = bestRouteToward(repeatTipState);
  let once = sim.applyPrepAction(repeatTipState, route.id, 'tip');
  const reportsAfterOnce = once.routeStates[route.id].intelReports.filter((report) => report.source === 'tip').length;
  once = sim.applyPrepAction(once, route.id, 'tip');
  const reportsAfterTwice = once.routeStates[route.id].intelReports.filter((report) => report.source === 'tip').length;
  assert(reportsAfterOnce === 1 && reportsAfterTwice === 1, 'Local Tip cannot be used repeatedly at one station');
}

const browser = await chromium.launch();
const viewports = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1280, 720]
];

for (const [width, height] of viewports) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(baseUrl);
  await page.waitForSelector('.title-screen');
  await assertNoHorizontalOverflow(page, `title ${width}x${height}`);
  const titleText = await page.locator('body').innerText();
  assert(titleText.includes('v1.0 submission build') && !/gold master candidate|pending deploy approval/i.test(titleText), `public title copy is release-ready ${width}x${height}`);
  await page.goto(`${baseUrl}#/about`);
  await page.waitForSelector('.competitor-card');
  await assertNoHorizontalOverflow(page, `about ${width}x${height}`);
  const aboutText = await page.locator('body').innerText();
  assert(!/gold master candidate|pending deploy approval|public URL pending/i.test(aboutText), `About copy has no candidate/pending language ${width}x${height}`);
  await assertSafeLink(page, demoUrl, `Demo URL safe link ${width}x${height}`);
  await assertSafeLink(page, repoUrl, `Repository URL safe link ${width}x${height}`);
  await page.locator('.competitor-card').scrollIntoViewIfNeeded();
  await assertElementVisible(page, '.competitor-card', `competitor card visible ${width}x${height}`);
  const href = await page.locator('.competitor-card a').getAttribute('href');
  const target = await page.locator('.competitor-card a').getAttribute('target');
  const rel = await page.locator('.competitor-card a').getAttribute('rel');
  assert(href === 'https://merlinforge.substack.com/p/dependency-day-a-single-file-in-browser' && target === '_blank' && rel?.includes('noopener') && rel?.includes('noreferrer'), 'About/Credits competitor link is correct and safe');
  const seed = 9100 + width;
  const seededState = sim.startSeededRun(seed, sim.dispatchOffices[0].id);
  const expectedRoute = bestRouteToward(seededState);
  const expectedDanger = dangerText(expectedRoute, seededState);
  await startSeededBrowserRun(page, seed, 0);
  await assertNoHorizontalOverflow(page, `game ${width}x${height}`);
  await assertFocusMapTighter(page, `Focus Contract tighter than Full Map ${width}x${height}`);
  await page.locator(`.route-hit[data-route-id="${expectedRoute.id}"]`).click();
  await page.waitForTimeout(80);
  await assertSelectedRouteLedgerReadable(page, `selected-route ledger ${width}x${height}`);
  const selectedLedger = await page.locator('.selected-route-ledger:not(.empty)').innerText();
  const selectedAria = await page.locator(`.route-hit[data-route-id="${expectedRoute.id}"]`).getAttribute('aria-label');
  assert(selectedLedger.includes(expectedDanger) && selectedAria?.includes(expectedDanger), `Displayed danger matches generation model ${width}x${height}`);
  await page.locator('[data-action="map-full"]').click();
  await page.waitForTimeout(80);
  assert((await page.locator('.map-wrap.full-network').count()) === 1, 'Full Map mode toggles on');
  await page.locator('[data-action="map-focus"]').click();
  await page.waitForTimeout(80);
  assert((await page.locator('.map-wrap.focus-contract').count()) === 1, 'Focus Contract mode toggles on');
  assert((await page.locator('.destination').count()) >= 1, 'Destination remains visible in gameplay');
  assert((await page.locator('.prep-action').count()) >= 8, 'Action panel exposes route actions');
  await page.close();
}

await browser.close();

async function startSeededBrowserRun(page, seed, officeIndex) {
  await page.goto(`${baseUrl}#/office`);
  await page.waitForSelector('.office-card');
  await page.evaluate((value) => {
    window.__ledgerOriginalDateNow ??= Date.now;
    window.__ledgerOriginalRandom ??= Math.random;
    Date.now = () => value;
    Math.random = () => 0;
  }, seed);
  await page.locator('.office-card').nth(officeIndex).click();
  await page.waitForSelector('.game-shell');
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    if (window.__ledgerOriginalDateNow && window.__ledgerOriginalRandom) {
      Date.now = window.__ledgerOriginalDateNow;
      Math.random = window.__ledgerOriginalRandom;
    }
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 2, `No horizontal overflow: ${label}`);
}

async function assertSafeLink(page, href, label) {
  const link = page.locator(`a[href="${href}"]`).first();
  const count = await link.count();
  const target = count ? await link.getAttribute('target') : undefined;
  const rel = count ? await link.getAttribute('rel') : undefined;
  assert(count > 0 && target === '_blank' && rel?.includes('noopener') && rel?.includes('noreferrer'), label);
}

async function assertElementVisible(page, selector, label) {
  const visible = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
  });
  assert(visible, label);
}

async function assertSelectedRouteLedgerReadable(page, label) {
  const readable = await page.locator('.selected-route-ledger:not(.empty)').evaluate((ledger) => {
    const cells = [...ledger.querySelectorAll('div')].map((cell) => cell.getBoundingClientRect());
    return cells.length >= 7 && cells.every((rect) => rect.width >= 105 && rect.height <= 74);
  });
  assert(readable, label);
}

async function assertFocusMapTighter(page, label) {
  const focus = await page.locator('.map-wrap.focus-contract').evaluate((wrap) => {
    const scale = Number(wrap.getAttribute('data-focus-scale') ?? '1');
    const current = wrap.querySelector('.node.current')?.getBoundingClientRect();
    const destination = wrap.querySelector('.node.destination')?.getBoundingClientRect();
    const frame = wrap.getBoundingClientRect();
    const visible = (rect) => Boolean(rect && rect.left >= frame.left && rect.right <= frame.right && rect.top >= frame.top && rect.bottom <= frame.bottom);
    return {
      scale,
      currentVisible: visible(current),
      destinationVisible: visible(destination),
      transform: getComputedStyle(wrap.querySelector('.map-base')).transform
    };
  });
  await page.locator('[data-action="map-full"]').click();
  await page.waitForTimeout(80);
  const fullTransform = await page.locator('.map-wrap.full-network .map-base').evaluate((element) => getComputedStyle(element).transform);
  await page.locator('[data-action="map-focus"]').click();
  await page.waitForTimeout(80);
  assert(focus.scale >= 1.15 && focus.transform !== fullTransform && focus.currentVisible && focus.destinationVisible, label);
}

const report = `# Dead Man's Ledger v0.6.1 Playtest Report

Base URL: ${baseUrl}

## Passes

${passes.map((item) => `- PASS: ${item}`).join('\n')}

## Findings

${findings.length ? findings.map((item) => `- FAIL: ${item}`).join('\n') : '- None'}
`;

await fs.writeFile(reportPath, report, 'utf8');
console.log(`Wrote ${reportPath}`);

if (findings.length) {
  console.error(report);
  process.exit(1);
}
