import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAlbers, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const width = 4096;
const height = 2304;

const excludeStateIds = new Set(['02', '15', '60', '66', '69', '72', '78']);
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

async function fetchRivers() {
  try {
    const response = await fetch(riversUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Natural Earth river fetch failed; continuing without river overlay: ${error}`);
    return null;
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
  for (let i = 0; i < 52; i += 1) {
    const y = 170 + i * 40;
    const opacity = i % 4 === 0 ? 0.11 : 0.055;
    const wobble = 22 + (i % 7) * 6;
    lines.push(
      `<path d="M 180 ${y} C 860 ${y - wobble}, 1430 ${y + wobble}, 2020 ${y - wobble / 2} S 3240 ${y + wobble}, 3920 ${y - 6}" fill="none" stroke="#6b5b42" stroke-width="2" opacity="${opacity}"/>`
    );
  }
  return lines.join('\n');
}

async function main() {
  const topo = await readTopoJson();
  const projection = createProjection();
  const geoPathGenerator = geoPath(projection);
  const stateCollection = feature(topo, topo.objects.states);
  const lower48 = stateCollection.features.filter((state) => !excludeStateIds.has(String(state.id)));
  const rivers = pickMajorRivers(await fetchRivers());

  const states = lower48
    .map((state) => {
      const d = geoPathGenerator(state);
      const name = escapeSvg(state.properties?.name || state.id);
      return `<path d="${d}" class="state" data-name="${name}"/>`;
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
      <stop offset="0%" stop-color="#a98555"/>
      <stop offset="45%" stop-color="#9a7245"/>
      <stop offset="100%" stop-color="#725633"/>
    </linearGradient>
    <filter id="paperNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="4" seed="31"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.16"/>
      </feComponentTransfer>
      <feBlend mode="multiply" in2="SourceGraphic"/>
    </filter>
    <filter id="coastShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#061018" flood-opacity="0.42"/>
    </filter>
    <style>
      .state {
        fill: url(#land);
        stroke: #4f432f;
        stroke-width: 2.1;
        stroke-opacity: 0.34;
        filter: url(#coastShadow);
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
  <rect width="${width}" height="${height}" fill="#b28c58" opacity="0.18" filter="url(#paperNoise)"/>
  <g opacity="0.42">${makeTerrainLines()}</g>
  <g>${states}</g>
  <g>${riverPaths}</g>
  <rect x="80" y="78" width="${width - 160}" height="${height - 156}" rx="42" fill="none" stroke="#d4af6a" stroke-width="8" opacity="0.48"/>
  <rect x="111" y="109" width="${width - 222}" height="${height - 218}" rx="28" fill="none" stroke="#281b12" stroke-width="3" opacity="0.55"/>
  <text x="176" y="2070" fill="#e6c987" font-family="Georgia, serif" font-size="44" opacity="0.82">Base map generated from open U.S. geodata. Gameplay nodes and routes are drawn live from coordinates.</text>
</svg>`;

  const outputDir = path.join(root, 'public', 'assets', 'map');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'map-base-usa-4k.svg'), svg, 'utf8');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outputDir, 'map-base-usa-4k.png'));
  await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(path.join(outputDir, 'map-base-usa-4k.webp'));

  console.log('Generated map-base-usa-4k.svg/png/webp from us-atlas and Natural Earth river data.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
