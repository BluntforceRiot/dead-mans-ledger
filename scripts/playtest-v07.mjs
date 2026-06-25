import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? process.env.PLAYTEST_BASE_URL ?? 'http://127.0.0.1:4173/';
const reportPath = path.resolve('PLAYTEST_REPORT_DEAD_MANS_LEDGER_V07.md');

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
  assert(await page.locator('.route-line.dispatching').count(), 'Cinematic dispatch highlights the active route');
  assert(await page.locator('.incident-pulse').count(), 'Cinematic dispatch shows an incident pulse');
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

await testOverflowScreens();

await startSeededFromOffice(9100, 0);
assert(await page.locator('.contract-accepted-stamp[aria-label="CONTRACT ACCEPTED"]').count(), 'Contract Accepted stamp appears on new game');
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
await page.waitForTimeout(820);
const unsettled = await page.locator('[data-settle-value]').evaluateAll((items) => items.filter((item) => item.textContent !== item.getAttribute('data-final')).length);
assert(unsettled === 0, 'Financial settlement animation ends at authoritative values');
assert((await page.locator('.result-card').filter({ hasText: 'Interest paid' }).count()) === 0, 'Zero-value settlement rows remain hidden');
await continueResult();
const legCount = Number(await page.locator('.dispatch-chronicle').getAttribute('data-chronicle-leg-count'));
assert(legCount >= 1, 'Chronicle records the completed route leg');

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
assert(await page.locator('.atlas-stamp[aria-label="ROUTE LEGEND"]').count(), 'Route Legend stamp appears on atlas screen');

await browser.close();

const report = [
  "# Dead Man's Ledger v0.7 Showmanship Playtest Report",
  '',
  `Base URL: ${baseUrl}`,
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
