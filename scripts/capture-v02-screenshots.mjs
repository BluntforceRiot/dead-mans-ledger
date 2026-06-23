import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4174/';
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
}

async function assignPrep(prepId) {
  await page.locator(`[data-prep-id="${prepId}"]`).click();
  await clickFirstReachableRoute();
  await page.waitForTimeout(80);
}

async function dispatchAndWait() {
  await page.locator('[data-action=dispatch]').click();
  await page.waitForTimeout(380);
}

async function waitForResult() {
  await page.waitForSelector('.result-card', { timeout: 2500 });
}

async function continueResult() {
  await page.locator('[data-action=continue-result]').click();
  await page.waitForTimeout(120);
}

await page.goto(baseUrl);
await shot('dead-mans-ledger-title-v02.png');

await page.goto(`${baseUrl}#/preview`);
await shot('dead-mans-ledger-map-preview-v02.png');

await page.goto(`${baseUrl}#/game`);
await shot('dead-mans-ledger-gameplay-v02.png');

await clickFirstReachableRoute();
await shot('dead-mans-ledger-route-selected-v02.png');

await assignPrep('scout');
await shot('dead-mans-ledger-prep-assigned-v02.png');

await dispatchAndWait();
await shot('dead-mans-ledger-event-vignette-v02.png');
await waitForResult();
await shot('dead-mans-ledger-result-v02.png');

let capturedLegend = await page.locator('.legend-result').count();
if (!capturedLegend) {
  await continueResult();
  for (let i = 0; i < 7; i += 1) {
    await clickFirstReachableRoute();
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
  await shot('dead-mans-ledger-journey-complete-v02.png');
}

await page.goto(`${baseUrl}#/fired`);
await shot('dead-mans-ledger-fired-v02.png');

await page.goto(`${baseUrl}#/scores`);
await shot('dead-mans-ledger-highscores-v02.png');

await browser.close();
console.log(`v0.2 screenshots written to ${outputDir}`);
