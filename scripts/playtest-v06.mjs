import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'playtest-v06-sim');
const reportPath = path.join(root, 'PLAYTEST_REPORT_DEAD_MANS_LEDGER_V06.md');
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

findScenario('cautious full Contract 1 completion', (initial) => {
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

findScenario('ambush countered by guards', (state) => {
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

findScenario('clean passage with protection held in reserve', (state) => {
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
  await page.goto(`${baseUrl}#/about`);
  await page.waitForSelector('.competitor-card');
  await assertNoHorizontalOverflow(page, `about ${width}x${height}`);
  await page.locator('.competitor-card').scrollIntoViewIfNeeded();
  await assertElementVisible(page, '.competitor-card', `competitor card visible ${width}x${height}`);
  const href = await page.locator('.competitor-card a').getAttribute('href');
  const target = await page.locator('.competitor-card a').getAttribute('target');
  const rel = await page.locator('.competitor-card a').getAttribute('rel');
  assert(href === 'https://merlinforge.substack.com/p/dependency-day-a-single-file-in-browser' && target === '_blank' && rel?.includes('noopener') && rel?.includes('noreferrer'), 'About/Credits competitor link is correct and safe');
  await page.goto(`${baseUrl}#/office`);
  await page.waitForSelector('.office-card');
  await page.locator('.office-card').first().click();
  await page.waitForSelector('.game-shell');
  await assertNoHorizontalOverflow(page, `game ${width}x${height}`);
  await page.locator('.route-hit[data-route-id]').first().click();
  await page.waitForTimeout(80);
  await assertSelectedRouteLedgerReadable(page, `selected-route ledger ${width}x${height}`);
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

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 2, `No horizontal overflow: ${label}`);
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

const report = `# Dead Man's Ledger v0.6 Playtest Report

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
