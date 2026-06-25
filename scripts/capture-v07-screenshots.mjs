import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('output', 'playwright');

await mkdir(outputDir, { recursive: true });
for (const file of await readdir(outputDir)) {
  if (file.includes('-v07') && file.endsWith('.png')) {
    await rm(path.join(outputDir, file), { force: true });
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name) {
  await page.screenshot({ path: path.join(outputDir, name), type: 'png', scale: 'css' });
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
  await page.locator('[data-action=skip-dispatch]').first().click();
  await page.waitForSelector('.result-card', { timeout: 1600 });
}

async function continueResult() {
  const button = page.locator('[data-action=continue-result]');
  if ((await button.count()) > 0) {
    await button.first().click();
    await page.waitForTimeout(150);
  }
}

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.atlas-stamp[aria-label="ROUTE LEGEND"]');
await page.waitForTimeout(1500);
await shot('dead-mans-ledger-route-legend-stamp-v07.png');

await startSeededFromOffice(9100, 0);
await page.waitForSelector('.contract-accepted-stamp[aria-label="CONTRACT ACCEPTED"]');
await shot('dead-mans-ledger-contract-accepted-stamp-v07.png');

const routeId = await chooseRoute();
await prepareRoute(routeId);
await page.locator('[data-action=dispatch]:not([disabled])').first().click();
await page.waitForSelector('.dispatch-cinematic', { timeout: 1000 });
await page.waitForTimeout(620);
await shot('dead-mans-ledger-cinematic-route-focus-v07.png');
await page.locator('[data-action=skip-dispatch]').first().click();
await page.waitForSelector('.result-card', { timeout: 1600 });
await page.waitForTimeout(820);
await shot('dead-mans-ledger-ledger-wire-headline-v07.png');
await shot('dead-mans-ledger-animated-settlement-final-v07.png');
await continueResult();

let chronicleCaptured = false;
for (let attempt = 0; attempt < 20 && !chronicleCaptured; attempt += 1) {
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
      await shot('dead-mans-ledger-dispatch-chronicle-v07.png');
      chronicleCaptured = true;
      break;
    }
    if (count === 0) {
      break;
    }
  }
}

if (!chronicleCaptured) {
  throw new Error('Could not capture Dispatch Chronicle with several completed legs.');
}

let deliveredCaptured = false;
for (let attempt = 0; attempt < 16 && !deliveredCaptured; attempt += 1) {
  await startSeededFromOffice(15000 + attempt * 113, attempt % 4);
  for (let leg = 0; leg < 12; leg += 1) {
    const nextRouteId = await chooseRoute();
    if (!nextRouteId) {
      break;
    }
    await prepareRoute(nextRouteId);
    await dispatchAndSkip();
    const text = await page.locator('.result-card').innerText();
    if (text.includes('CONTRACT DELIVERED') && text.includes('DELIVERED')) {
      await page.waitForTimeout(820);
      await shot('dead-mans-ledger-delivered-stamp-v07.png');
      deliveredCaptured = true;
      break;
    }
    if (text.includes('Face the Board')) {
      break;
    }
    await continueResult();
  }
}

if (!deliveredCaptured) {
  throw new Error('Could not capture Delivered stamp.');
}

await browser.close();
console.log(`v0.7 showmanship screenshots written to ${outputDir} from ${baseUrl}`);
