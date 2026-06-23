#!/usr/bin/env bash
set -euo pipefail

export TMPDIR="${TMPDIR:-/tmp}"
export TEMP="${TEMP:-/tmp}"
export TMP="${TMP:-/tmp}"

PW="/mnt/c/Users/Bluntforce/.codex/skills/playwright/scripts/playwright_cli.sh"
OUT="/mnt/n/HomelabForge/Dead Man’s Ledger/output"
BASE_URL="${1:-http://127.0.0.1:4173/}"

mkdir -p "$OUT"

shot() {
  local filename="$1"
  "$PW" run-code "async (page) => {
    await page.screenshot({ path: 'output/${filename}', type: 'png', scale: 'css' });
  }"
}

"$PW" close-all >/dev/null 2>&1 || true
"$PW" open "$BASE_URL"
"$PW" resize 1440 900
shot "dead-mans-ledger-title-v01.png"

"$PW" goto "${BASE_URL}#/preview"
shot "dead-mans-ledger-map-preview-v01.png"

"$PW" goto "${BASE_URL}#/game"
shot "dead-mans-ledger-gameplay-v01.png"
"$PW" run-code 'async (page) => {
  await page.evaluate(() => {
  const line = document.querySelector(".route-line.reachable");
  const hit = line?.previousElementSibling;
  hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}'
shot "dead-mans-ledger-route-selected-v01.png"

"$PW" run-code 'async (page) => {
  await page.locator("[data-action=dispatch]").click();
  await page.waitForTimeout(380);
}'
shot "dead-mans-ledger-event-vignette-v01.png"
"$PW" run-code 'async (page) => {
  await page.waitForTimeout(900);
}'
shot "dead-mans-ledger-result-v01.png"

"$PW" goto "${BASE_URL}#/fired"
shot "dead-mans-ledger-fired-v01.png"

"$PW" goto "${BASE_URL}#/scores"
shot "dead-mans-ledger-highscores-v01.png"
"$PW" close-all >/dev/null 2>&1 || true
