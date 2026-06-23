import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('output', 'playwright');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name) {
  await page.screenshot({ path: path.join(outputDir, name), type: 'png', scale: 'css' });
}

async function clickReachableRoute({ preferExpress = false } = {}) {
  const clicked = await page.evaluate((prefer) => {
    const hits = [...document.querySelectorAll('.route-hit[data-route-id]')];
    const toward = hits.filter((item) => item.getAttribute('aria-label')?.includes('toward destination'));
    const pool = toward.length ? toward : hits;
    const hit =
      (prefer &&
        pool.find((item) => item.nextElementSibling?.classList.contains('express'))) ||
      pool[0];
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return Boolean(hit);
  }, preferExpress);
  await page.waitForTimeout(120);
  return clicked;
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
  await page.waitForTimeout(80);
  return true;
}

async function assignPrepToRoute(prepId, routeId) {
  const action = page.locator(`[data-prep-id="${prepId}"]:not([disabled])`);
  if ((await action.count()) === 0) {
    return false;
  }
  await action.first().click();
  await clickRouteId(routeId);
  await page.waitForTimeout(80);
  return true;
}

async function fortifySelectedRoute() {
  for (const prepId of ['scout', 'telegraph', 'guards', 'repair', 'decoy', 'delay', 'insurance']) {
    await assignPrepIfAvailable(prepId);
  }
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
  await page.waitForSelector('.result-card', { timeout: 3200 });
}

async function continueResult() {
  const button = page.locator('[data-action=continue-result]');
  if ((await button.count()) > 0) {
    await button.first().click();
    await page.waitForTimeout(150);
  }
}

async function startFromOffice(index = 0) {
  await page.goto(`${baseUrl}#/office`);
  await page.waitForSelector('.office-card');
  await page.locator('.office-card').nth(index).click();
  await page.waitForSelector('.game-shell');
}

async function findScoutedAmbushRoute() {
  const routeIds = await reachableRouteIds();
  for (const routeId of routeIds) {
    await assignPrepToRoute('scout', routeId);
    const text = (await page.locator('.selected-route').innerText().catch(() => '')) || '';
    if (text.includes('Outlaw Ambush')) {
      return routeId;
    }
  }
  return undefined;
}

async function captureAmbushScenario({ defended }) {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    await startFromOffice(attempt % 4);
    const routeId = await findScoutedAmbushRoute();
    if (!routeId) {
      continue;
    }
    if (defended) {
      await assignPrepToRoute('guards', routeId);
      await assignPrepToRoute('decoy', routeId);
    }
    await clickRouteId(routeId);
    if (!(await dispatch())) {
      continue;
    }
    await waitForResult();
    const text = await page.locator('.result-card').innerText();
    if (!text.includes('Outlaw Ambush')) {
      continue;
    }
    const isDefended = text.includes('SHIPMENT MOVING') || text.includes('Counter Worked');
    if ((defended && isDefended) || (!defended && !isDefended)) {
      await shot(defended ? 'dead-mans-ledger-defended-ambush-v05.png' : 'dead-mans-ledger-ambush-v05.png');
      return true;
    }
  }
  throw new Error(`Could not capture ${defended ? 'defended ' : ''}ambush scenario`);
}

async function captureDestinationArrival() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await startFromOffice(attempt % 4);
    for (let leg = 0; leg < 14; leg += 1) {
      await clickReachableRoute();
      await fortifySelectedRoute();
      if (!(await dispatch())) {
        break;
      }
      await waitForResult();
      const text = await page.locator('.result-card').innerText();
      if (text.includes('CONTRACT DELIVERED')) {
        await shot('dead-mans-ledger-destination-arrival-v05.png');
        return true;
      }
      if (text.includes('Face the Board')) {
        break;
      }
      await continueResult();
    }
  }
  await shot('dead-mans-ledger-destination-arrival-v05.png');
  return false;
}

await page.goto(baseUrl);
await page.waitForSelector('.title-screen');
await shot('dead-mans-ledger-title-v05.png');

await page.goto(`${baseUrl}#/office`);
await page.waitForSelector('.office-grid');
await shot('dead-mans-ledger-office-choice-v05.png');

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.map-stage');
await shot('dead-mans-ledger-route-atlas-v05.png');

await startFromOffice(0);
await shot('dead-mans-ledger-contract-v05.png');
await shot('dead-mans-ledger-gameplay-v05.png');

await clickReachableRoute();
await shot('dead-mans-ledger-route-selected-v05.png');

await assignPrepIfAvailable('scout');
await assignPrepIfAvailable('telegraph');
await shot('dead-mans-ledger-intel-v05.png');

await assignPrepIfAvailable('guards');
await shot('dead-mans-ledger-prep-assigned-v05.png');

await dispatch();
await page.waitForTimeout(330);
await shot('dead-mans-ledger-dispatch-v05.png');
await waitForResult();
await shot('dead-mans-ledger-result-v05.png');

await captureAmbushScenario({ defended: false });
await captureAmbushScenario({ defended: true });
await captureDestinationArrival();

if ((await page.locator('text=Face the Board').count()) > 0) {
  await page.locator('[data-action=continue-result]').click();
  await page.waitForSelector('.fired-screen');
} else {
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
}

if ((await page.locator('.fired-screen').count()) > 0) {
  await shot('dead-mans-ledger-fired-v05.png');
} else {
  await page.goto(`${baseUrl}#/scores`);
  await shot('dead-mans-ledger-fired-v05.png');
}

await page.goto(`${baseUrl}#/scores`);
await page.waitForSelector('.score-page');
await shot('dead-mans-ledger-highscores-v05.png');

await browser.close();
console.log(`v0.5 screenshots written to ${outputDir} from ${baseUrl}`);
