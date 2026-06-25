import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('output', 'playwright');

await mkdir(outputDir, { recursive: true });
for (const file of await readdir(outputDir)) {
  if (file.includes('-v073') && file.endsWith('.png')) {
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
  await page.waitForTimeout(160);
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
  await page.waitForTimeout(160);
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
  await page.waitForTimeout(110);
  return clicked;
}

async function clickReachableRoute({ preferExpress = false } = {}) {
  const routeId = await page.evaluate((prefer) => {
    const hits = [...document.querySelectorAll('.route-hit[data-route-id]')];
    const toward = hits.filter((item) => item.getAttribute('aria-label')?.includes('toward destination'));
    const pool = toward.length ? toward : hits;
    const hit = (prefer && pool.find((item) => item.nextElementSibling?.classList.contains('express'))) || pool[0];
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return hit?.getAttribute('data-route-id');
  }, preferExpress);
  await page.waitForTimeout(130);
  return routeId;
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
  await page.waitForTimeout(100);
  return true;
}

async function assignPrepToRoute(prepId, routeId) {
  const action = page.locator(`[data-prep-id="${prepId}"]:not([disabled])`);
  if ((await action.count()) === 0) {
    return false;
  }
  await action.first().click();
  await clickRouteId(routeId);
  await page.waitForTimeout(100);
  return true;
}

async function dispatch({ skip = true } = {}) {
  const button = page.locator('[data-action=dispatch]:not([disabled])');
  if ((await button.count()) === 0) {
    return false;
  }
  await button.first().click();
  if (skip) {
    await page.waitForSelector('.dispatch-cinematic', { timeout: 1000 });
    await page.locator('[data-action=skip-dispatch]').first().click();
  }
  return true;
}

async function waitForResult() {
  await page.waitForSelector('.result-card', { timeout: 3800 });
}

async function continueResult() {
  const button = page.locator('[data-action=continue-result]');
  if ((await button.count()) > 0) {
    await button.first().click();
    await page.waitForTimeout(170);
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

async function captureIncident(name, finder, setup, predicate, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await startSeededFromOffice(10000 + attempt * 97, attempt % 4);
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
  console.warn(`Could not capture exact ${name}; saving current page as fallback.`);
  await shot(name);
  return false;
}

await page.goto(baseUrl);
await page.waitForSelector('.title-screen');
await shot('dead-mans-ledger-title-v073.png');

await page.goto(`${baseUrl}#/office`);
await page.waitForSelector('.office-grid');
await shot('dead-mans-ledger-office-selection-v073.png');

await page.goto(`${baseUrl}#/about`);
await page.waitForSelector('.competitor-card');
await page.locator('.competitor-card').scrollIntoViewIfNeeded();
await page.waitForTimeout(120);
await shot('dead-mans-ledger-about-credits-competitor-reference-v073.png');

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.map-stage');
await shot('dead-mans-ledger-route-atlas-v073.png');
await page.waitForTimeout(1500);
await shot('dead-mans-ledger-route-legend-stamp-v073.png');

await startSeededFromOffice(9100, 0);
await shot('dead-mans-ledger-contract-accepted-v073.png');
await shot('dead-mans-ledger-focus-contract-v073.png');
await page.locator('[data-action="map-full"]').first().click();
await page.waitForTimeout(120);
await shot('dead-mans-ledger-full-map-v073.png');
await page.locator('[data-action="map-focus"]').first().click();
await page.waitForTimeout(120);

await clickReachableRoute();
await shot('dead-mans-ledger-selected-route-correct-direction-v073.png');
await assignPrepIfAvailable('scout');
await assignPrepIfAvailable('telegraph');
await shot('dead-mans-ledger-intelligence-gathered-v073.png');
await assignPrepIfAvailable('guards');
await shot('dead-mans-ledger-counter-assigned-v073.png');

let capturedRumor = false;
for (let attempt = 0; attempt < 32 && !capturedRumor; attempt += 1) {
  await startSeededFromOffice(9000 + attempt * 41, attempt % 4);
  const rumorNotice = page.locator('.rumor-strip').filter({ hasText: /local tip available/i });
  if ((await rumorNotice.count()) > 0) {
    await shot('dead-mans-ledger-station-rumor-available-v073.png');
    capturedRumor = true;
  }
}
if (!capturedRumor) {
  throw new Error('Could not capture station rumor available state.');
}

await startSeededFromOffice(9100, 0);
await clickReachableRoute();
await dispatch({ skip: false });
await page.waitForSelector('.dispatch-cinematic');
await page.waitForTimeout(420);
await shot('dead-mans-ledger-dispatch-cinematic-v073.png');
await page.locator('[data-action=skip-dispatch]').first().click();
await waitForResult();
await shot('dead-mans-ledger-ledger-wire-v073.png');
await shot('dead-mans-ledger-compact-result-ledger-v073.png');
await shot('dead-mans-ledger-clean-passage-v073.png');
await continueResult();

let capturedChronicle = false;
for (let attempt = 0; attempt < 18 && !capturedChronicle; attempt += 1) {
  await startSeededFromOffice(12000 + attempt * 97, attempt % 4);
  for (let leg = 0; leg < 5; leg += 1) {
    const routeId = await clickReachableRoute();
    if (!routeId) {
      break;
    }
    for (const prepId of ['scout', 'telegraph', 'guards', 'repair', 'decoy', 'delay', 'insurance']) {
      await assignPrepIfAvailable(prepId);
    }
    await dispatch();
    await waitForResult();
    await continueResult();
    const count = Number(await page.locator('.dispatch-chronicle').getAttribute('data-chronicle-leg-count'));
    if (count >= 3) {
      await shot('dead-mans-ledger-dispatch-chronicle-several-legs-v073.png');
      capturedChronicle = true;
      break;
    }
    if (count === 0) {
      break;
    }
  }
}
if (!capturedChronicle) {
  throw new Error('Could not capture Dispatch Chronicle with several completed legs.');
}

await captureIncident(
  'dead-mans-ledger-outlaw-ambush-v073.png',
  () => findRouteByIntel({ prepId: 'scout', includes: 'Outlaw Ambush' }),
  async () => {},
  (text) => text.includes('Outlaw Ambush') && text.includes('SHIPMENT DISRUPTED')
);

await captureIncident(
  'dead-mans-ledger-defended-ambush-v073.png',
  () => findRouteByIntel({ prepId: 'scout', includes: 'Outlaw Ambush' }),
  async (routeId) => {
    await assignPrepToRoute('guards', routeId);
    await assignPrepToRoute('decoy', routeId);
  },
  (text) => text.includes('Outlaw Ambush') && text.includes('COUNTER WORKED'),
  140
);

await captureIncident(
  'dead-mans-ledger-track-repair-v073.png',
  () => findRouteByIntel({ prepId: 'scout', includes: 'Track Cut' }),
  async (routeId) => {
    await assignPrepToRoute('repair', routeId);
  },
  (text) => text.includes('Track Cut') && text.includes('COUNTER WORKED'),
  140
);

await captureIncident(
  'dead-mans-ledger-bad-weather-v073.png',
  () => findRouteByIntel({ prepId: 'telegraph', includes: 'Bad Weather' }),
  async (routeId) => {
    await assignPrepToRoute('delay', routeId);
  },
  (text) => text.includes('Bad Weather'),
  120
);

await captureIncident(
  'dead-mans-ledger-false-rumor-v073.png',
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
  (text) => /False rumor|FALSE RUMOR|False Local Tip/i.test(text),
  180
);

let capturedDestination = false;
for (let attempt = 0; attempt < 12; attempt += 1) {
  await startSeededFromOffice(24000 + attempt * 31, attempt % 4);
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
    if (text.includes('CONTRACT DELIVERED') && text.includes('DELIVERED')) {
      await shot('dead-mans-ledger-delivered-contract-v073.png');
      capturedDestination = true;
      attempt = 99;
      break;
    }
    if (text.includes('Face the Board')) {
      break;
    }
    await continueResult();
  }
}
if (!capturedDestination) {
  throw new Error('Could not capture delivered contract result.');
}

await startSeededFromOffice(31000, 2);
for (let i = 0; i < 90; i += 1) {
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
  await shot('dead-mans-ledger-fired-screen-v073.png');
} else {
  await page.goto(`${baseUrl}#/scores`);
  await shot('dead-mans-ledger-fired-screen-v073.png');
}

await page.goto(`${baseUrl}#/scores`);
await page.waitForSelector('.score-page');
await shot('dead-mans-ledger-high-score-ledger-v073.png');

await browser.close();
console.log(`v0.7.3 screenshots written to ${outputDir} from ${baseUrl}`);
