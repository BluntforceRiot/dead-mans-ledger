import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'playtest-v071-sim');
const baseUrl = process.argv[2] ?? process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:4173/';
const reportPath = path.join(root, 'PLAYTEST_REPORT_DEAD_MANS_LEDGER_V072.md');

const passes = [];
const findings = [];

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

function officeIndex(officeId) {
  return sim.dispatchOffices.findIndex((office) => office.id === officeId);
}

function routeTravelName(route, fromNodeId) {
  return `${sim.findNodeName(fromNodeId)} -> ${sim.findNodeName(sim.otherEnd(route, fromNodeId))}`;
}

function expectedStamp(status, cardText) {
  if (status === 'DELIVERED') {
    return 'DELIVERED';
  }
  if (status === 'COUNTER WORKED') {
    return 'COUNTER WORKED';
  }
  if (status === 'CLEAN PASSAGE') {
    return 'CLEAN PASSAGE';
  }
  if (status === 'CONTRACT EXPIRED') {
    return 'CONTRACT EXPIRED';
  }
  if (/FIRED BY THE BOARD/.test(cardText)) {
    return 'FIRED BY THE BOARD';
  }
  return '';
}

function headlineMatches(status, headline) {
  if (status === 'DELIVERED') {
    return /REACHES/.test(headline);
  }
  if (status === 'CLEAN PASSAGE') {
    return /CLEARS|WITHOUT INCIDENT/.test(headline);
  }
  if (status === 'COUNTER WORKED') {
    return /BREAK|REOPENED|BRIDGE|WEATHER|HOLDS|MOVING/.test(headline);
  }
  if (status === 'SHIPMENT DISRUPTED') {
    return /LOSS|FALSE RUMOR/.test(headline);
  }
  return headline.length > 10;
}

function findDirectionalCase({ reverse, needsFailure = false }) {
  for (let seed = 8000; seed < 24000; seed += 17) {
    for (const office of sim.dispatchOffices) {
      const state = sim.startSeededRun(seed, office.id);
      const route = sim.getLegalAdjacentRoutes(state).find((candidate) => {
        const directionMatches = reverse ? candidate.to === state.currentNodeId : candidate.from === state.currentNodeId;
        if (!directionMatches) {
          return false;
        }
        if (needsFailure) {
          const resultState = sim.resolveDispatch({ ...state, selectedRouteId: candidate.id }, candidate.id);
          return Boolean(
            resultState.lastResult &&
              !resultState.lastResult.success &&
              !['false-tip', 'scout-missing'].includes(resultState.lastResult.hazard.id)
          );
        }
        return true;
      });
      if (route) {
        const resultState = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
        return {
          seed,
          officeId: office.id,
          officeIndex: officeIndex(office.id),
          route,
          fromNodeId: state.currentNodeId,
          expectedDirection: routeTravelName(route, state.currentNodeId),
          result: resultState.lastResult
        };
      }
    }
  }
  throw new Error(`Could not find ${reverse ? 'reverse' : 'forward'} directional case.`);
}

function findCleanReserveCase() {
  for (let seed = 30000; seed < 52000; seed += 23) {
    for (const office of sim.dispatchOffices) {
      let state = sim.startSeededRun(seed, office.id);
      const route = sim.getLegalAdjacentRoutes(state).find((candidate) => state.routeStates[candidate.id].hazardIds.every((id) => id === 'clean'));
      if (!route) {
        continue;
      }
      state = sim.applyPrepAction(state, route.id, 'guards');
      const resultState = sim.resolveDispatch({ ...state, selectedRouteId: route.id }, route.id);
      if (resultState.lastResult?.protectionHeld.includes('guards')) {
        return {
          seed,
          officeId: office.id,
          officeIndex: officeIndex(office.id),
          route,
          fromNodeId: state.currentNodeId,
          expectedDirection: routeTravelName(route, state.currentNodeId)
        };
      }
    }
  }
  throw new Error('Could not find clean reserve case.');
}

function findFalseRumorCase() {
  for (let seed = 42000; seed < 90000; seed += 19) {
    for (const office of sim.dispatchOffices) {
      const initial = sim.startSeededRun(seed, office.id);
      if (!initial.stationRumor.available || !['false', 'bait'].includes(initial.stationRumor.quality)) {
        continue;
      }
      for (const route of sim.getLegalAdjacentRoutes(initial)) {
        const tipped = sim.applyPrepAction(initial, route.id, 'tip');
        const resultState = sim.resolveDispatch({ ...tipped, selectedRouteId: route.id }, route.id);
        if (resultState.lastResult?.localRumorOutcome === 'false' && !resultState.lastResult.success) {
          return {
            seed,
            officeId: office.id,
            officeIndex: officeIndex(office.id),
            route,
            fromNodeId: initial.currentNodeId,
            expectedDirection: routeTravelName(route, initial.currentNodeId)
          };
        }
      }
    }
  }
  throw new Error('Could not find false-rumor failure case.');
}

const forwardCase = findDirectionalCase({ reverse: false });
const reverseCase = findDirectionalCase({ reverse: true });
const failureDirectionCase = findDirectionalCase({ reverse: true, needsFailure: true });
const cleanReserveCase = findCleanReserveCase();
const falseRumorCase = findFalseRumorCase();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function startSeededFromOffice(seed, index = 0) {
  await page.goto(`${baseUrl}#/office`);
  await page.waitForSelector('.office-card');
  await page.evaluate((value) => {
    window.__ledgerOriginalDateNow ??= Date.now;
    window.__ledgerOriginalRandom ??= Math.random;
    Date.now = () => value;
    Math.random = () => 0;
  }, seed);
  await page.locator('.office-card').nth(index).click();
  await page.waitForSelector('.game-shell');
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    if (window.__ledgerOriginalDateNow && window.__ledgerOriginalRandom) {
      Date.now = window.__ledgerOriginalDateNow;
      Math.random = window.__ledgerOriginalRandom;
    }
  });
}

async function clickRouteId(routeId) {
  const clicked = await page.evaluate((id) => {
    const hit = document.querySelector(`.route-hit[data-route-id="${id}"]`);
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return Boolean(hit);
  }, routeId);
  await page.waitForTimeout(80);
  return clicked;
}

async function chooseRoute() {
  const routeId = await page.evaluate(() => {
    const hits = [...document.querySelectorAll('.route-hit[data-route-id]')];
    const toward = hits.filter((item) => item.getAttribute('aria-label')?.includes('toward destination'));
    return (toward[0] ?? hits[0])?.getAttribute('data-route-id');
  });
  if (routeId) {
    await clickRouteId(routeId);
  }
  return routeId;
}

async function assignPrepToRoute(prepId, routeId) {
  const action = page.locator(`[data-prep-id="${prepId}"]:not([disabled])`);
  if ((await action.count()) === 0) {
    return false;
  }
  await action.first().click();
  await clickRouteId(routeId);
  return true;
}

async function prepareRoute(routeId) {
  for (const prepId of ['scout', 'telegraph', 'guards', 'repair', 'decoy', 'delay', 'insurance']) {
    await assignPrepToRoute(prepId, routeId);
  }
  await clickRouteId(routeId);
}

async function dispatchAndSkip() {
  await page.locator('[data-action=dispatch]:not([disabled])').first().click();
  await page.waitForSelector('.dispatch-cinematic', { timeout: 1000 });
  assert((await page.locator('.route-line.dispatching').count()) > 0, 'Cinematic dispatch highlights the active route');
  assert((await page.locator('.incident-pulse').count()) > 0, 'Cinematic dispatch shows an incident pulse');
  assert((await page.locator('[data-action=skip-dispatch]').count()) > 0, 'Skip Animation is available during dispatch');
  await page.locator('[data-action=skip-dispatch]').first().click();
  await page.waitForSelector('.result-card', { timeout: 1600 });
}

async function continueResult() {
  const button = page.locator('[data-action=continue-result]');
  if ((await button.count()) > 0) {
    await button.first().click();
    await page.waitForTimeout(140);
  }
}

async function assertNoOverflow(label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `No horizontal overflow: ${label}`);
}

async function testOverflowScreens() {
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1280, 720]
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl);
    await page.waitForSelector('.title-screen');
    await assertNoOverflow(`title ${width}x${height}`);
    await page.goto(`${baseUrl}#/preview`);
    await page.waitForSelector('.map-stage');
    await assertNoOverflow(`route legend ${width}x${height}`);
    await startSeededFromOffice(7000 + width, 0);
    await assertNoOverflow(`game ${width}x${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function assertRouteDirection(testCase, label) {
  await startSeededFromOffice(testCase.seed, testCase.officeIndex);
  await clickRouteId(testCase.route.id);
  const ledgerText = await page.locator('.selected-route-ledger').innerText();
  assert(ledgerText.includes(testCase.expectedDirection), `${label}: selected-route ledger uses actual travel direction`);
  const aria = await page.locator(`.route-hit[data-route-id="${testCase.route.id}"]`).getAttribute('aria-label');
  assert((aria ?? '').includes(testCase.expectedDirection), `${label}: gameplay route aria-label uses actual travel direction`);
}

async function assertResultDirection(testCase) {
  await startSeededFromOffice(testCase.seed, testCase.officeIndex);
  await clickRouteId(testCase.route.id);
  await dispatchAndSkip();
  const cardText = await page.locator('.result-card').innerText();
  assert(cardText.includes(testCase.expectedDirection), 'Result Route Summary uses actual travel direction');
  const headline = ((await page.locator('[data-testid="ledger-wire-headline"]').getAttribute('data-headline')) ?? '').toUpperCase();
  assert(headline.includes(testCase.expectedDirection.toUpperCase()), 'Ledger Wire headline always uses actual travel direction');
  const sealTitle = (await page.locator('.event-seal').last().getAttribute('title')) ?? '';
  assert(sealTitle.includes(testCase.expectedDirection), 'Chronicle event seal tooltip uses actual travel direction');
  await continueResult();
}

async function assertResultLayout(label) {
  const actionVisible = await page.locator('.result-primary-action').isVisible();
  assert(actionVisible, `${label}: primary result action remains visible`);
  const layout = await page.locator('.result-card').evaluate((card) => ({
    scrollHeight: card.scrollHeight,
    clientHeight: card.clientHeight,
    bottom: card.getBoundingClientRect().bottom,
    viewport: window.innerHeight
  }));
  assert(layout.bottom <= layout.viewport + 1, `${label}: result card is not clipped by viewport`);
  assert(layout.scrollHeight <= layout.clientHeight + 24, `${label}: primary result information fits without major card scrolling`);
}

await testOverflowScreens();

await page.goto(`${baseUrl}#/about`);
await page.waitForSelector('.competitor-card a[href*="dependency-day"]');
assert((await page.locator('.competitor-card a[href*="dependency-day"]').count()) > 0, 'Competitor reference remains linked and visible');
assert(!/candidate|pending/i.test(await page.locator('body').innerText()), 'No candidate/pending wording on About screen');

await assertRouteDirection(forwardCase, 'Forward direction case');
await assertRouteDirection(reverseCase, 'Reverse direction case');

await startSeededFromOffice(9100, 0);
assert((await page.locator('.contract-accepted-stamp[aria-label="CONTRACT ACCEPTED"]').count()) > 0, 'Contract Accepted stamp appears on new game');
const protectedRoute = page.locator('.route-hit[data-route-id][aria-label*="board-cleared starter route"]');
assert((await protectedRoute.count()) === 1, 'Exactly one tutorial-protected route is exposed in first contract UI');
const protectedAria = (await protectedRoute.first().getAttribute('aria-label')) ?? '';
assert(protectedAria.includes('0% protected') || protectedAria.includes('0 percent protected'), 'Tutorial-protected route aria-label truthfully reports zero protected danger');
await protectedRoute.first().click();
await page.waitForTimeout(80);
const protectedLedger = await page.locator('.selected-route-ledger').innerText();
assert(protectedLedger.includes('0% protected') && /Board-cleared starter route/i.test(protectedLedger), 'Selected tutorial route visibly explains board-cleared protection');

const routeId = await chooseRoute();
assert(Boolean(routeId), 'A reachable route can be selected');
await prepareRoute(routeId);
await dispatchAndSkip();
const status = await page.locator('.result-card').getAttribute('data-result-status');
const cardText = await page.locator('.result-card').innerText();
const stamp = await page.locator('.result-card .gold-ledger-stamp').first().getAttribute('aria-label').catch(() => '');
const expected = expectedStamp(status ?? '', cardText);
if (expected) {
  assert(stamp === expected, `Stamp matches actual result state: ${expected}`);
} else {
  assert(!stamp, 'No state stamp is shown for an unstamped result state');
}
const headline = (await page.locator('[data-testid="ledger-wire-headline"]').getAttribute('data-headline')) ?? '';
assert(headlineMatches(status ?? '', headline), 'Ledger Wire headline reflects the current route result');
const resultRoute = await page.locator('.result-section').filter({ hasText: 'Route Summary' }).first().innerText();
const resultDirection = resultRoute
  .split('\n')
  .find((line) => line.includes('->'))
  ?.trim();
assert(Boolean(resultDirection) && headline.toUpperCase().includes(resultDirection.toUpperCase()), 'Ledger Wire headline includes the result route direction');
await page.waitForTimeout(820);
const unsettled = await page.locator('[data-settle-value]').evaluateAll((items) => items.filter((item) => item.textContent !== item.getAttribute('data-final')).length);
assert(unsettled === 0, 'Financial settlement animation ends at authoritative values');
assert((await page.locator('.result-card').filter({ hasText: 'Interest paid' }).count()) === 0, 'Zero-value settlement rows remain hidden');
assert(!cardText.includes('Held in reserve; no matching incident required it.'), 'Result ledger removes repeated reserve boilerplate');
await assertResultLayout('Showmanship result');
await continueResult();
const legCount = Number(await page.locator('.dispatch-chronicle').getAttribute('data-chronicle-leg-count'));
assert(legCount >= 1, 'Chronicle records the completed route leg');

await assertResultDirection(failureDirectionCase);

await startSeededFromOffice(falseRumorCase.seed, falseRumorCase.officeIndex);
await clickRouteId(falseRumorCase.route.id);
await assignPrepToRoute('tip', falseRumorCase.route.id);
await dispatchAndSkip();
const falseRumorHeadline = ((await page.locator('[data-testid="ledger-wire-headline"]').getAttribute('data-headline')) ?? '').toUpperCase();
assert(falseRumorHeadline.includes('FALSE RUMOR') && falseRumorHeadline.includes(falseRumorCase.expectedDirection.toUpperCase()), 'False-rumor Ledger Wire headline includes actual travel direction');
await continueResult();

await startSeededFromOffice(cleanReserveCase.seed, cleanReserveCase.officeIndex);
await clickRouteId(cleanReserveCase.route.id);
await assignPrepToRoute('guards', cleanReserveCase.route.id);
await dispatchAndSkip();
const reserveText = await page.locator('.result-card').innerText();
assert(/Protection Held In Reserve/i.test(reserveText) && /Hire Guards|Guards/i.test(reserveText), 'Reserve protection is compacted into one summary row');
await assertResultLayout('Clean-passage reserve result');
await continueResult();

let severalLegs = false;
for (let attempt = 0; attempt < 18 && !severalLegs; attempt += 1) {
  await startSeededFromOffice(12000 + attempt * 97, attempt % 4);
  for (let leg = 0; leg < 5; leg += 1) {
    const nextRouteId = await chooseRoute();
    if (!nextRouteId) {
      break;
    }
    await prepareRoute(nextRouteId);
    await dispatchAndSkip();
    await continueResult();
    const count = Number(await page.locator('.dispatch-chronicle').getAttribute('data-chronicle-leg-count'));
    if (count >= 3) {
      severalLegs = true;
      break;
    }
    if (count === 0) {
      break;
    }
  }
}
assert(severalLegs, 'Chronicle reflects several completed legs before contract reset');
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(120);
const chronicleScroll = await page.locator('.chronicle-route').evaluate((item) => ({
  clientWidth: item.clientWidth,
  scrollWidth: item.scrollWidth
}));
assert(chronicleScroll.scrollWidth <= chronicleScroll.clientWidth + 1, 'Chronicle station strip is fully readable at 1280x720');

await page.locator('[data-action="map-full"]').first().click();
await page.waitForTimeout(80);
assert((await page.locator('.map-wrap.full-network').count()) > 0, 'Full Map mode works');
await page.locator('[data-action="map-focus"]').first().click();
await page.waitForTimeout(80);
assert((await page.locator('.map-wrap.focus-contract').count()) > 0, 'Focus Contract mode works');
await page.setViewportSize({ width: 1440, height: 900 });

await page.emulateMedia({ reducedMotion: 'reduce' });
await startSeededFromOffice(14000, 1);
const reducedRouteId = await chooseRoute();
await prepareRoute(reducedRouteId);
await page.locator('[data-action=dispatch]:not([disabled])').first().click();
await page.waitForSelector('.result-card', { timeout: 1500 });
await page.waitForTimeout(80);
const reducedUnsettled = await page.locator('[data-settle-value]').evaluateAll((items) => items.filter((item) => item.textContent !== item.getAttribute('data-final')).length);
assert(reducedUnsettled === 0, 'Reduced-motion mode settles values instantly');
await page.emulateMedia({ reducedMotion: 'no-preference' });

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.atlas-stamp[aria-label="ROUTE LEGEND"]');
assert((await page.locator('.atlas-stamp[aria-label="ROUTE LEGEND"]').count()) > 0, 'Route Legend stamp appears on atlas screen');

await browser.close();

const report = [
  "# Dead Man's Ledger v0.7.2 Truth-And-Release Playtest Report",
  '',
  `Base URL: ${baseUrl}`,
  '',
  '## Direction Cases',
  '',
  `- Forward: ${forwardCase.expectedDirection}`,
  `- Reverse: ${reverseCase.expectedDirection}`,
  `- Result/headline reverse: ${failureDirectionCase.expectedDirection}`,
  '',
  '## Passes',
  '',
  ...passes.map((item) => `- PASS: ${item}`),
  '',
  '## Findings',
  '',
  ...(findings.length ? findings.map((item) => `- FAIL: ${item}`) : ['- None'])
].join('\n');

await fs.writeFile(reportPath, `${report}\n`);
console.log(`Wrote ${reportPath}`);

if (findings.length) {
  process.exitCode = 1;
}
