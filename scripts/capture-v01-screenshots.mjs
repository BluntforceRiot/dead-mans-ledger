import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('output');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name) {
  await page.screenshot({ path: path.join(outputDir, name), type: 'png', scale: 'css' });
}

await page.goto(baseUrl);
await shot('dead-mans-ledger-title-v01.png');

await page.goto(`${baseUrl}#/preview`);
await shot('dead-mans-ledger-map-preview-v01.png');

await page.goto(`${baseUrl}#/game`);
await shot('dead-mans-ledger-gameplay-v01.png');
await page.evaluate(() => {
  const line = document.querySelector('.route-line.reachable');
  const hit = line?.previousElementSibling;
  hit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await shot('dead-mans-ledger-route-selected-v01.png');

await page.locator('[data-action=dispatch]').click();
await page.waitForTimeout(380);
await shot('dead-mans-ledger-event-vignette-v01.png');
await page.waitForTimeout(900);
await shot('dead-mans-ledger-result-v01.png');

await page.goto(`${baseUrl}#/fired`);
await shot('dead-mans-ledger-fired-v01.png');

await page.goto(`${baseUrl}#/scores`);
await shot('dead-mans-ledger-highscores-v01.png');

await browser.close();
console.log(`Screenshots written to ${outputDir}`);
