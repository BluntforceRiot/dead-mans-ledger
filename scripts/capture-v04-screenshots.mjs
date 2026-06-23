import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('output');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name) {
  await page.screenshot({ path: path.join(outputDir, name), type: 'png', scale: 'css' });
}

async function clickFirstReachableRoute() {
  await page.evaluate(() => {
    const line = document.querySelector('.route-line.reachable');
    const hit = line?.previousElementSibling;
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(100);
}

async function assignPrep(prepId) {
  await page.locator(`[data-prep-id="${prepId}"]`).click();
  await clickFirstReachableRoute();
}

async function assignPrepIfAvailable(prepId) {
  const action = page.locator(`[data-prep-id="${prepId}"]:not([disabled])`);
  if ((await action.count()) === 0) {
    return;
  }
  await action.click();
  await clickFirstReachableRoute();
}

async function fortifyNextRoute() {
  for (const prepId of ['scout', 'telegraph', 'guards', 'repair', 'decoy']) {
    await assignPrepIfAvailable(prepId);
  }
  if ((await page.locator('[data-action=dispatch]:not([disabled])').count()) === 0) {
    await assignPrepIfAvailable('borrow');
    await assignPrepIfAvailable('insurance');
  }
}

async function dispatchAndCaptureMotion() {
  await page.locator('[data-action=dispatch]').click();
  await page.waitForTimeout(330);
  await shot('dead-mans-ledger-dispatch-animation-v04.png');
}

async function waitForResult() {
  await page.waitForSelector('.result-card', { timeout: 2600 });
}

async function continueResult() {
  await page.locator('[data-action=continue-result]').click();
  await page.waitForTimeout(140);
}

await page.goto(baseUrl);
await shot('dead-mans-ledger-title-v04.png');

await page.goto(`${baseUrl}#/preview`);
await page.waitForSelector('.map-stage');
await shot('dead-mans-ledger-map-preview-v04.png');

await page.goto(`${baseUrl}#/game`);
await page.waitForSelector('.game-shell');
await shot('dead-mans-ledger-gameplay-v04.png');

await clickFirstReachableRoute();
await shot('dead-mans-ledger-route-selected-v04.png');

await assignPrep('scout');
await shot('dead-mans-ledger-prep-assigned-v04.png');

await dispatchAndCaptureMotion();
await waitForResult();
await shot('dead-mans-ledger-event-vignette-v04.png');
await shot('dead-mans-ledger-result-v04.png');

let capturedLegend = await page.locator('.legend-result').count();
if (!capturedLegend) {
  await continueResult();
  for (let i = 0; i < 8; i += 1) {
    await clickFirstReachableRoute();
    await fortifyNextRoute();
    if ((await page.locator('[data-action=dispatch]:not([disabled])').count()) === 0) {
      break;
    }
    await page.locator('[data-action=dispatch]').click();
    await waitForResult();
    capturedLegend = await page.locator('.legend-result').count();
    if (capturedLegend) {
      break;
    }
    if ((await page.locator('text=Face the Board').count()) > 0) {
      break;
    }
    await continueResult();
  }
}

if (capturedLegend) {
  await shot('dead-mans-ledger-journey-complete-v04.png');
} else {
  await page.goto(`${baseUrl}#/game`);
  await page.waitForSelector('.game-shell');
  await shot('dead-mans-ledger-journey-complete-v04.png');
}

await page.goto(`${baseUrl}#/fired`);
await shot('dead-mans-ledger-fired-v04.png');

await page.goto(`${baseUrl}#/scores`);
await shot('dead-mans-ledger-highscores-v04.png');

await browser.close();
console.log(`v0.4 screenshots written to ${outputDir} from ${baseUrl}`);
