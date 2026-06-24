import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('output', 'playwright');

await mkdir(outputDir, { recursive: true });
for (const file of await readdir(outputDir)) {
  if (file.includes('-v06') && file.endsWith('.png')) {
    await rm(path.join(outputDir, file), { force: true });
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name) {
  await page.screenshot({ path: path.join(outputDir, name), type: 'png', scale: 'css' });
}

async function startFromOffice(index = 0) {
  await page.goto(`${baseUrl}#/office`);
  await page.waitForSelector('.office-card');
  await page.locator('.office-card').nth(index % (await page.locator('.office-card').count())).click();
  await page.waitForSelector('.game-shell');
  await page.waitForTimeout(150);
}

async function startSeededFromOffice(seed, index = 0) {
  await page.goto(`${baseUrl}#/office`);
  await page.waitForSelector('.office-card');
  await page.evaluate((value) => {
    window.__ledgerOriginalDateNow ??= Date.now;
    window.__ledgerOriginalRandom ??= Math.random;
    Date.now = () => value;
    Math.random = () => 0;
  }, seed);
  await page.locator('.office-card').nth(index % (await page.locator('.office-card').count())).click();
  await page.waitForSelector('.game-shell');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    if (window.__ledgerOriginalDateNow && window.__ledgerOriginalRandom) {
      Date.now = window.__ledgerOriginalDateNow;
      Math.random = window.__ledgerOriginalRandom;
    }
  });
}

async function reachableRouteIds() {
  return page.evaluate(() => [...document.querySelectorAll('.route-hit[data-route-id]')].map((item) => item.getAttribute('data-route-id')).filter(Boolean));
}

async function clickRouteId(routeId) {
  const clicked = await page.evaluate((id) => {
    const hit = document.querySelector(`.route-hit[data-route-id="${id}"]`);
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return Boolean(hit);
  }, routeId);
  await page.waitForTimeout(100);
  return clicked;
}

async function clickReachableRoute({ preferExpress = false } = {}) {
  const clicked = await page.evaluate((prefer) => {
    const hits = [...document.querySelectorAll('.route-hit[data-route-id]')];
    const toward = hits.filter((item) => item.getAttribute('aria-label')?.includes('toward destination'));
    const pool = toward.length ? toward : hits;
    const hit =
      (prefer && pool.find((item) => item.nextElementSibling?.classList.contains('express'))) ||
      pool[0];
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return Boolean(hit);
  }, preferExpress);
  await page.waitForTimeout(120);
  return clicked;
}

async function assignPrepIfAvailable(prepId) {
  const action = page.locator(`[data-prep-id="${prepId}"]:not([disabled])`);
  if ((await action.count()) === 0) {
    return false;
  }
  await action.first().click();
  if (prepId !== 'borrow') {
    await clickReachableRoute();
  }
  await page.waitForTimeout(90);
  return true;
}

async function assignPrepToRoute(prepId, routeId) {
  const action = page.locator(`[data-prep-id="${prepId}"]:not([disabled])`);
  if ((await action.count()) === 0) {
    return false;
  }
  await action.first().click();
  await clickRouteId(routeId);
  await page.waitForTimeout(90);
  return true;
}

async function dispatch() {
  const button = page.locator('[data-action=dispatch]:not([disabled])');
  if ((await button.count()) === 0) {
    return false;
  }
  await button.first().click();
  return true;
}

async function waitForResult() {
  await page.waitForSelector('.result-card', { timeout: 3600 });
}

async function continueResult() {
  const button = page.locator('[data-action=continue-result]');
  if ((await button.count()) > 0) {
    await button.first().click();
    await page.waitForTimeout(160);
  }
}

async function findRouteByIntel({ prepId, includes }) {
  const routeIds = await reachableRouteIds();
  for (const routeId of routeIds) {
    await assignPrepToRoute(prepId, routeId);
    const text = (await page.locator('.selected-route-ledger').innerText().catch(() => '')) || '';
    if (text.includes(includes)) {
      return routeId;
    }
  }
  return undefined;
}

async function captureIncident(name, finder, setup, predicate, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await startFromOffice(attempt % 4);
    const routeId = await finder();
    if (!routeId) {
      continue;
    }
    await setup(routeId);
    await clickRouteId(routeId);
    if (!(await dispatch())) {
      continue;
    }
    await waitForResult();
    const text = await page.locator('.result-card').innerText();
    if (predicate(text)) {
      await shot(name);
      return true;
    }
  }
  console.warn(`Could not capture ${name}; saving current page as fallback.`);
  await shot(name);
  return false;
}

await page.goto(baseUrl);
await page.waitForSelector('.title-screen');
await shot('dead-mans-ledger-title-v06.png');

await page.goto(`${baseUrl}#/office`);
await page.waitForSelector('.office-grid');
await shot('dead-mans-ledger-office-choice-v06.png');

await page.goto(`${baseUrl}#/about`);
await page.waitForSelector('.competitor-card');
await page.locator('.competitor-card').scrollIntoViewIfNeeded();
await page.waitForTimeout(120);
await shot('dead-mans-ledger-about-competitor-v06.png');

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.map-stage');
await shot('dead-mans-ledger-route-atlas-v06.png');

await startFromOffice(0);
await shot('dead-mans-ledger-focus-contract-v06.png');
await shot('dead-mans-ledger-current-contract-v06.png');
await clickReachableRoute();
await shot('dead-mans-ledger-selected-route-v06.png');
await assignPrepIfAvailable('scout');
await assignPrepIfAvailable('telegraph');
await shot('dead-mans-ledger-intelligence-gathered-v06.png');
await assignPrepIfAvailable('guards');
await shot('dead-mans-ledger-guard-counter-assigned-v06.png');
await assignPrepIfAvailable('borrow');
await shot('dead-mans-ledger-debt-and-repayment-v06.png');
await dispatch();
await page.waitForTimeout(330);
await shot('dead-mans-ledger-dispatch-animation-v06.png');
await waitForResult();
await continueResult();

let capturedRumor = false;
let capturedNoRumor = false;
for (let attempt = 0; attempt < 24 && (!capturedRumor || !capturedNoRumor); attempt += 1) {
  await startSeededFromOffice(9000 + attempt * 41, attempt % 4);
  const rumorNotice = page.locator('.rumor-strip, .rumor-card').filter({ hasText: /local tip available/i });
  const rumorCount = await rumorNotice.count();
  const text = rumorCount ? await rumorNotice.first().innerText() : '';
  if (!capturedRumor && /local tip available/i.test(text)) {
    await shot('dead-mans-ledger-station-rumor-available-v06.png');
    capturedRumor = true;
  }
  if (!capturedNoRumor && rumorCount === 0 && (await page.locator('[data-prep-id="tip"]').count()) === 0) {
    await shot('dead-mans-ledger-station-no-local-tip-v06.png');
    capturedNoRumor = true;
  }
}

if (!capturedRumor || !capturedNoRumor) {
  throw new Error('Could not capture both station rumor and no-local-tip screenshot states.');
}

await captureIncident(
  'dead-mans-ledger-outlaw-ambush-v06.png',
  () => findRouteByIntel({ prepId: 'scout', includes: 'Outlaw Ambush' }),
  async () => {},
  (text) => text.includes('Outlaw Ambush') && text.includes('SHIPMENT DISRUPTED')
);

await startSeededFromOffice(1444, 3);
const defendedRouteId = await findRouteByIntel({ prepId: 'scout', includes: 'Outlaw Ambush' });
if (defendedRouteId) {
  await assignPrepToRoute('guards', defendedRouteId);
  await assignPrepToRoute('decoy', defendedRouteId);
  await clickRouteId(defendedRouteId);
  await dispatch();
  await waitForResult();
}
await shot('dead-mans-ledger-defended-ambush-v06.png');

await captureIncident(
  'dead-mans-ledger-track-repair-v06.png',
  () => findRouteByIntel({ prepId: 'scout', includes: 'Track Cut' }),
  async (routeId) => {
    await assignPrepToRoute('repair', routeId);
  },
  (text) => text.includes('Track Cut') && text.includes('COUNTERS SUCCEEDED')
);

await captureIncident(
  'dead-mans-ledger-bad-weather-v06.png',
  () => findRouteByIntel({ prepId: 'telegraph', includes: 'Bad Weather' }),
  async (routeId) => {
    await assignPrepToRoute('delay', routeId);
  },
  (text) => text.includes('Bad Weather')
);

await captureIncident(
  'dead-mans-ledger-clean-passage-reserve-v06.png',
  async () => {
    const ids = await reachableRouteIds();
    return ids[0];
  },
  async (routeId) => {
    await assignPrepToRoute('guards', routeId);
  },
  (text) => text.includes('Clean Passage') && text.includes('PROTECTION HELD IN RESERVE'),
  120
);

await captureIncident(
  'dead-mans-ledger-false-local-rumor-v06.png',
  async () => {
    if ((await page.locator('[data-prep-id="tip"]:not([disabled])').count()) === 0) {
      return undefined;
    }
    const ids = await reachableRouteIds();
    return ids[0];
  },
  async (routeId) => {
    await assignPrepToRoute('tip', routeId);
  },
  (text) => text.includes('False rumor'),
  160
);

for (let attempt = 0; attempt < 10; attempt += 1) {
  await startFromOffice(attempt % 4);
  for (let leg = 0; leg < 12; leg += 1) {
    await clickReachableRoute();
    for (const prepId of ['scout', 'telegraph', 'guards', 'repair', 'decoy', 'delay', 'insurance']) {
      await assignPrepIfAvailable(prepId);
    }
    if (!(await dispatch())) {
      break;
    }
    await waitForResult();
    const text = await page.locator('.result-card').innerText();
    if (text.includes('CONTRACT DELIVERED')) {
      await shot('dead-mans-ledger-destination-arrival-v06.png');
      attempt = 99;
      break;
    }
    if (text.includes('Face the Board')) {
      break;
    }
    await continueResult();
  }
}

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.map-stage');
await shot('dead-mans-ledger-route-legend-milestone-v06.png');

await startFromOffice(2);
for (let i = 0; i < 80; i += 1) {
  await assignPrepIfAvailable('borrow');
  await clickReachableRoute({ preferExpress: true });
  if (!(await dispatch())) {
    break;
  }
  await waitForResult();
  if ((await page.locator('text=Face the Board').count()) > 0) {
    await page.locator('[data-action=continue-result]').click();
    await page.waitForSelector('.fired-screen');
    break;
  }
  await continueResult();
}
if ((await page.locator('.fired-screen').count()) > 0) {
  await shot('dead-mans-ledger-fired-screen-v06.png');
} else {
  await page.goto(`${baseUrl}#/scores`);
  await shot('dead-mans-ledger-fired-screen-v06.png');
}

await page.goto(`${baseUrl}#/scores`);
await page.waitForSelector('.score-page');
await shot('dead-mans-ledger-high-score-ledger-v06.png');

await browser.close();
console.log(`v0.6 screenshots written to ${outputDir} from ${baseUrl}`);
