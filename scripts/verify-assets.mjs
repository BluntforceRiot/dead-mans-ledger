import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const required = [
  'public/assets/map/map-base-usa-4k.svg',
  'public/assets/map/map-base-usa-4k.png',
  'public/assets/map/map-base-usa-4k.webp',
  'public/assets/ui/gold-logo.svg',
  'public/assets/events/successful-delivery.svg',
  'public/assets/events/destination-arrival.svg',
  'public/assets/events/ambush.svg',
  'public/assets/events/defended-ambush.svg',
  'public/assets/events/track-cut.svg',
  'public/assets/events/bridge-damage.svg',
  'public/assets/events/repair-crew.svg',
  'public/assets/events/repair-ambush.svg',
  'public/assets/events/bad-weather.svg',
  'public/assets/events/inside-leak.svg',
  'public/assets/events/rival-sabotage.svg',
  'public/assets/events/telegraph-cut.svg',
  'public/assets/events/decoy-success.svg',
  'public/assets/events/false-tip.svg',
  'public/assets/events/failed-delivery.svg',
  'public/assets/tokens/train.svg',
  'public/assets/tokens/stagecoach.svg',
  'public/assets/tokens/scout.svg',
  'public/assets/tokens/guards.svg',
  'public/assets/tokens/repair-crew.svg',
  'public/assets/tokens/telegraph.svg',
  'public/assets/tokens/strongbox.svg',
  'public/assets/tokens/decoy.svg',
  'public/assets/tokens/insurance.svg',
  'public/assets/tokens/credit.svg',
  'public/assets/tokens/debt.svg',
  'public/assets/tokens/rumor.svg'
];

const raster = new Set(['.png', '.webp', '.jpg', '.jpeg']);
const failures = [];

for (const file of required) {
  const absolute = path.join(root, file);
  try {
    const stat = await fs.stat(absolute);
    if (stat.size <= 0) {
      failures.push(`${file} is zero bytes`);
      continue;
    }
    if (raster.has(path.extname(file))) {
      const metadata = await sharp(absolute).metadata();
      if (!metadata.width || !metadata.height) {
        failures.push(`${file} has unreadable dimensions`);
      }
    } else if (path.extname(file) === '.svg') {
      const text = await fs.readFile(absolute, 'utf8');
      if (!text.includes('<svg')) {
        failures.push(`${file} is not valid-looking SVG`);
      }
    }
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}

if (failures.length) {
  console.error('Asset verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Verified ${required.length} required runtime assets.`);
