import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbers, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const width = 4096;
const height = 2304;

const excludeStateIds = new Set(['02', '15', '60', '66', '69', '72', '78']);
const localRiversPath = path.join(root, 'scripts', 'geodata', 'major-rivers-fallback.geojson');
const riversUrl =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson';

function createProjection() {
  return geoAlbers()
    .parallels([29.5, 45.5])
    .rotate([96, 0])
    .center([-0.6, 38.7])
    .scale(4520.179188231777)
    .translate([2047.0615534894691, 1135.4042996638475]);
}

function escapeSvg(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function readTopoJson() {
  const source = path.join(root, 'node_modules', 'us-atlas', 'states-10m.json');
  return JSON.parse(await fs.readFile(source, 'utf8'));
}

async function readRivers() {
  try {
    return JSON.parse(await fs.readFile(localRiversPath, 'utf8'));
  } catch {
    return fetchRivers();
  }
}

async function fetchRivers() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(riversUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Natural Earth river fetch failed; continuing without river overlay: ${error}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function pickMajorRivers(geojson) {
  if (!geojson?.features) {
    return [];
  }

  const names = [
    'Mississippi',
    'Missouri',
    'Ohio',
    'Arkansas',
    'Platte',
    'Columbia',
    'Colorado',
    'Rio Grande',
    'Red'
  ];

  return geojson.features.filter((river) => {
    const name = river.properties?.name || river.properties?.name_en || '';
    return names.some((needle) => name.toLowerCase().includes(needle.toLowerCase()));
  });
}

function makeTerrainLines() {
  const lines = [];
  for (let i = 0; i < 66; i += 1) {
    const y = 130 + i * 33;
    const opacity = i % 5 === 0 ? 0.09 : 0.045;
    const wobble = 18 + (i % 7) * 5;
    lines.push(
      `<path d="M 180 ${y} C 860 ${y - wobble}, 1430 ${y + wobble}, 2020 ${y - wobble / 2} S 3240 ${y + wobble}, 3920 ${y - 6}" fill="none" stroke="#5e4c31" stroke-width="1.7" opacity="${opacity}"/>`
    );
  }
  return lines.join('\n');
}

function makeEngravingHatch() {
  const lines = [];
  for (let i = -30; i < 70; i += 1) {
    const x = i * 72;
    lines.push(`<path d="M ${x} 2290 L ${x + 980} 0" stroke="#1f2e31" stroke-width="1.2" opacity="0.035"/>`);
  }
  return lines.join('\n');
}

async function main() {
  const topo = await readTopoJson();
  const projection = createProjection();
  const geoPathGenerator = geoPath(projection);
  const stateCollection = feature(topo, topo.objects.states);
  const lower48 = stateCollection.features.filter((state) => !excludeStateIds.has(String(state.id)));
  const lower48Geometries = topo.objects.states.geometries.filter((state) => !excludeStateIds.has(String(state.id)));
  const mergedLand = merge(topo, lower48Geometries);
  const rivers = pickMajorRivers(await readRivers());

  const landPath = geoPathGenerator(mergedLand);
  const stateLines = lower48
    .map((state) => {
      const d = geoPathGenerator(state);
      const name = escapeSvg(state.properties?.name || state.id);
      return `<path d="${d}" class="state-line" data-name="${name}"/>`;
    })
    .join('\n');

  const riverPaths = rivers
    .map((river) => {
      const d = geoPathGenerator(river);
      const name = escapeSvg(river.properties?.name || 'river');
      if (!d) {
        return '';
      }
      const strong = /mississippi|missouri|ohio/i.test(name);
      return `<path d="${d}" class="${strong ? 'river river-strong' : 'river'}" data-name="${name}"/>`;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="oceanGlow" cx="52%" cy="42%" r="78%">
      <stop offset="0%" stop-color="#213b4d"/>
      <stop offset="100%" stop-color="#122532"/>
    </radialGradient>
    <linearGradient id="land" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#ba925b"/>
      <stop offset="45%" stop-color="#a67a45"/>
      <stop offset="100%" stop-color="#7f6039"/>
    </linearGradient>
    <filter id="paperNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.014 0.02" numOctaves="5" seed="31"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.22"/>
      </feComponentTransfer>
      <feBlend mode="multiply" in2="SourceGraphic"/>
    </filter>
    <filter id="coastShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#061018" flood-opacity="0.42"/>
    </filter>
    <style>
      .land {
        fill: url(#land);
        stroke: #594229;
        stroke-width: 2.4;
        stroke-opacity: 0.42;
      }
      .state-line {
        fill: none;
        stroke: #493925;
        stroke-width: 1.05;
        stroke-opacity: 0.085;
      }
      .river {
        fill: none;
        stroke: #5c8390;
        stroke-width: 5;
        stroke-linecap: round;
        stroke-opacity: 0.45;
        mix-blend-mode: screen;
      }
      .river-strong {
        stroke-width: 7;
        stroke-opacity: 0.58;
      }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#oceanGlow)"/>
  <rect width="${width}" height="${height}" fill="#b28c58" opacity="0.14" filter="url(#paperNoise)"/>
  <g opacity="0.3">${makeTerrainLines()}</g>
  <g filter="url(#coastShadow)"><path d="${landPath}" class="land"/></g>
  <g>${stateLines}</g>
  <g opacity="0.5">${makeEngravingHatch()}</g>
  <g>${riverPaths}</g>
  <rect width="${width}" height="${height}" fill="#f0c978" opacity="0.08" filter="url(#paperNoise)"/>
  <rect x="80" y="78" width="${width - 160}" height="${height - 156}" rx="42" fill="none" stroke="#d4af6a" stroke-width="8" opacity="0.48"/>
  <rect x="111" y="109" width="${width - 222}" height="${height - 218}" rx="28" fill="none" stroke="#281b12" stroke-width="3" opacity="0.55"/>
  <text x="176" y="2070" fill="#e6c987" font-family="Georgia, serif" font-size="44" opacity="0.82">Open U.S. geography styled as a playable frontier route board.</text>
</svg>`;

  const outputDir = path.join(root, 'public', 'assets', 'map');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'map-base-usa-4k.svg'), svg, 'utf8');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outputDir, 'map-base-usa-4k.png'));
  await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(path.join(outputDir, 'map-base-usa-4k.webp'));

  console.log('Generated map-base-usa-4k.svg/png/webp from us-atlas and local/timed-fallback river data.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
