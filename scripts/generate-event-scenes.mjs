import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'assets', 'events');

const common = `
  <defs>
    <style>
      .glint { animation: glint 2.8s ease-in-out infinite; transform-origin: center; }
      .dust { animation: dust 3s ease-in-out infinite; }
      .wire { animation: wire 2.4s steps(2, end) infinite; }
      .rain { animation: rain 2.2s linear infinite; }
      @keyframes glint { 0%, 100% { opacity: .28; transform: scale(.82); } 50% { opacity: .95; transform: scale(1.18); } }
      @keyframes dust { 0%, 100% { opacity: .25; transform: translateX(-6px); } 50% { opacity: .65; transform: translateX(8px); } }
      @keyframes wire { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
      @keyframes rain { from { transform: translateX(-18px); } to { transform: translateX(18px); } }
      @media (prefers-reduced-motion: reduce) { .glint, .dust, .wire, .rain { animation: none; } }
    </style>
    <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#203744"/><stop offset="1" stop-color="#0d171d"/></linearGradient>
    <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#fff0ae"/><stop offset=".5" stop-color="#d59d3e"/><stop offset="1" stop-color="#fff1b8"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <rect width="360" height="220" rx="18" fill="url(#sky)"/>
  <path d="M0 154 C65 126 118 142 176 127 S286 124 360 96 V220 H0z" fill="#2d402d"/>
  <path d="M0 178 C82 154 130 173 200 148 S301 146 360 128 V220 H0z" fill="#6b4c28"/>
  <path d="M18 184 C94 169 154 174 242 157 S322 150 352 142" fill="none" stroke="#d0a464" stroke-width="5" stroke-linecap="round" opacity=".72"/>
  <circle class="dust" cx="92" cy="169" r="18" fill="#d0a464" opacity=".28"/>
  <circle class="glint" cx="315" cy="62" r="10" fill="#ffe9a8" opacity=".35"/>
`;

function scene(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 220" role="img" aria-label="${title}">
${common}
  ${body}
  <rect x="9" y="9" width="342" height="202" rx="15" fill="none" stroke="#e1b764" stroke-width="3" opacity=".72"/>
  <text x="180" y="29" text-anchor="middle" font-family="Georgia,serif" font-size="17" font-weight="800" fill="#ffe7a6">${title}</text>
</svg>
`;
}

const train = `<g filter="url(#shadow)"><rect x="118" y="131" width="92" height="34" rx="6" fill="#17262c" stroke="#e0b45d" stroke-width="3"/><rect x="204" y="119" width="44" height="46" rx="5" fill="#20343a" stroke="#e0b45d" stroke-width="3"/><circle cx="139" cy="170" r="12" fill="#111"/><circle cx="225" cy="170" r="12" fill="#111"/><path d="M96 164h180" stroke="#1b1510" stroke-width="5" stroke-linecap="round"/></g>`;
const coach = `<g filter="url(#shadow)"><rect x="132" y="128" width="82" height="38" rx="8" fill="#6e2f24" stroke="#e6bb68" stroke-width="3"/><path d="M145 128l18-19h39l20 19" fill="#263940" stroke="#e6bb68" stroke-width="3"/><circle cx="150" cy="171" r="12" fill="#141414"/><circle cx="205" cy="171" r="12" fill="#141414"/></g>`;
const outlaws = `<g fill="#171014" opacity=".94"><path d="M73 133h28l-8 42H81z"/><circle cx="87" cy="119" r="13"/><path d="M58 130h57" stroke="#171014" stroke-width="7" stroke-linecap="round"/><path d="M281 124h26l-7 45h-14z"/><circle cx="294" cy="111" r="12"/><path d="M268 123h50" stroke="#171014" stroke-width="7" stroke-linecap="round"/></g>`;
const guard = `<g filter="url(#shadow)" fill="#1f3a42" stroke="#f0c36d" stroke-width="3"><path d="M91 126h28l-8 45H98z"/><circle cx="105" cy="111" r="12"/><path d="M78 130h52"/></g>`;
const strongbox = `<g filter="url(#shadow)"><rect x="154" y="136" width="54" height="36" rx="5" fill="#213238" stroke="#f0c36d" stroke-width="4"/><path d="M154 149h54" stroke="#f0c36d" stroke-width="3"/><circle cx="181" cy="154" r="6" fill="url(#gold)"/></g>`;
const station = `<g filter="url(#shadow)"><path d="M230 94h72v78h-72z" fill="#24363a" stroke="#e0b45d" stroke-width="3"/><path d="M220 98l46-32 47 32z" fill="#704225" stroke="#e0b45d" stroke-width="3"/><rect x="252" y="128" width="20" height="44" fill="#111b20"/><rect x="236" y="112" width="18" height="18" fill="#ffd77a"/><rect x="280" y="112" width="18" height="18" fill="#ffd77a"/></g>`;
const telegraph = `<g filter="url(#shadow)"><path d="M270 72v99" stroke="#2c1c10" stroke-width="7"/><path d="M238 86h63" stroke="#2c1c10" stroke-width="6"/><path d="M246 91l-26 45M294 91l-28 50" stroke="#f1c66e" stroke-width="3"/><path d="M220 72l20 14-22 8 24 13" fill="none" stroke="#ffeaa7" stroke-width="4" stroke-linecap="round"/></g>`;
const ledgerStamp = `<g filter="url(#shadow)"><rect x="84" y="92" width="104" height="72" rx="7" fill="#ead7a6" stroke="#e0b45d" stroke-width="4"/><path d="M101 116h68M101 132h54M101 148h62" stroke="#4a2d13" stroke-width="4" stroke-linecap="round"/><circle class="glint" cx="211" cy="118" r="24" fill="#f6c863" stroke="#fff0ad" stroke-width="4"/></g>`;
const horseTeam = `<g filter="url(#shadow)" fill="#171014"><ellipse cx="101" cy="156" rx="20" ry="12"/><circle cx="84" cy="145" r="8"/><path d="M91 166l-9 18M107 166l9 18M118 154l28-12" stroke="#171014" stroke-width="5" stroke-linecap="round"/><ellipse cx="242" cy="156" rx="20" ry="12"/><circle cx="260" cy="145" r="8"/><path d="M236 166l-9 18M252 166l9 18M222 154l-28-12" stroke="#171014" stroke-width="5" stroke-linecap="round"/></g>`;
const muzzleFlash = `<g class="glint"><path d="M58 112l18 5-14 12 4-17z" fill="#ffcf72"/><path d="M311 103l-19 5 15 12-5-17z" fill="#ffcf72"/></g>`;
const goldLight = `<path class="glint" d="M213 68c42 8 73 31 97 66" fill="none" stroke="#fff0ad" stroke-width="7" stroke-linecap="round" opacity=".38"/>`;

const scenes = {
  'successful-delivery.svg': scene('Clean Passage', `${train}${station}<path d="M80 86c36-22 68-19 91 2" fill="none" stroke="#ffe9a8" stroke-width="4" opacity=".6"/>`),
  'destination-arrival.svg': scene('Destination Arrival', `${station}${ledgerStamp}${goldLight}<g filter="url(#shadow)" fill="#1a262b" stroke="#f0c36d" stroke-width="2"><circle cx="55" cy="136" r="8"/><path d="M47 145h16l-4 28H51z"/><circle cx="320" cy="139" r="7"/><path d="M313 147h14l-4 24h-8z"/></g><path d="M191 133l25 18 45-56" fill="none" stroke="#ffe9a8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path class="glint" d="M250 64l10 18 19 3-14 13 4 19-19-9-17 10 3-20-15-13 20-3z" fill="#fff0ad" opacity=".75"/>`),
  'ambush.svg': scene('Outlaw Ambush', `${horseTeam}${coach}${outlaws}${muzzleFlash}<path d="M66 104l45 34M306 96l-52 39" stroke="#f06f4e" stroke-width="4" stroke-linecap="round"/><path class="dust" d="M42 177c49-18 94-9 135-23M221 164c39-11 67-10 105-28" stroke="#d0a464" stroke-width="6" opacity=".36" fill="none"/>`),
  'defended-ambush.svg': scene('Defended Ambush', `${horseTeam}${guard}${coach}${outlaws}<path d="M113 126l50 19M248 132l-44 18" stroke="#ffe5a1" stroke-width="4" stroke-linecap="round"/><path class="glint" d="M132 118c28-18 70-18 104 1" stroke="#fff0ad" stroke-width="6" stroke-linecap="round" fill="none" opacity=".42"/><circle cx="181" cy="151" r="24" fill="#ffe5a1" opacity=".12"/>`),
  'track-cut.svg': scene('Track Cut', `${train}<path d="M86 174h92M208 174h78" stroke="#0e0d0b" stroke-width="7" stroke-linecap="round"/><path d="M177 162l24 27M201 160l-28 30" stroke="#ff9b62" stroke-width="6" stroke-linecap="round"/>`),
  'bridge-damage.svg': scene('Washed Bridge', `${coach}<path d="M54 170h92M214 170h92" stroke="#2b1c11" stroke-width="9" stroke-linecap="round"/><path d="M145 170c24 16 49 16 70 0" fill="none" stroke="#5fa8b3" stroke-width="12" stroke-linecap="round"/><path d="M152 150l25 25 25-26" fill="none" stroke="#f06f4e" stroke-width="5"/>`),
  'repair-crew.svg': scene('Repair Crew Success', `${train}<path d="M70 176h82M207 176h88" stroke="#110d0a" stroke-width="7" stroke-linecap="round"/><g filter="url(#shadow)" fill="#2c4a4d" stroke="#f0c36d" stroke-width="3"><circle cx="80" cy="128" r="11"/><path d="M70 140h22l-5 35H75z"/><circle cx="272" cy="128" r="11"/><path d="M262 140h22l-5 35h-12z"/></g><path d="M98 162l42-23M250 162l-42-23" stroke="#ffe7a6" stroke-width="5" stroke-linecap="round"/><path class="glint" d="M164 169h45" stroke="#fff0ad" stroke-width="8" stroke-linecap="round" opacity=".62"/><circle class="glint" cx="184" cy="166" r="12" fill="#fff0ad" opacity=".32"/>`),
  'repair-ambush.svg': scene('Repair Crew Ambushed', `${outlaws}<g filter="url(#shadow)" fill="#2c4a4d" stroke="#f0c36d" stroke-width="3"><circle cx="174" cy="123" r="12"/><path d="M162 136h25l-7 39h-14z"/></g><path d="M78 113l78 35M293 110l-80 40" stroke="#f06f4e" stroke-width="4"/>`),
  'bad-weather.svg': scene('Bad Weather', `<path d="M18 72c46-32 105-29 139-5 41-25 98-25 143 7" fill="#101b21" opacity=".82"/><path d="M203 61l-24 45 30-9-20 46" fill="none" stroke="#ffe38c" stroke-width="6" stroke-linejoin="round" opacity=".72"/>${coach}<g class="rain"><path d="M28 64h120M16 91h168M188 62h138M164 95h160M42 123h116M210 125h120" stroke="#dce8e9" stroke-width="6" stroke-linecap="round" opacity=".7"/><path d="M90 56l-13 31M132 54l-14 34M244 56l-16 35M294 58l-13 32M71 121l-18 34M266 116l-20 38" stroke="#9fd4df" stroke-width="4" opacity=".85"/></g><path d="M45 180c79-18 149-4 270-28" stroke="#8db0b5" stroke-width="5" opacity=".3" fill="none"/>`),
  'snowstorm.svg': scene('Bad Weather', `${coach}<g fill="#e8f4f2" opacity=".85"><circle cx="70" cy="70" r="5"/><circle cx="116" cy="96" r="4"/><circle cx="190" cy="71" r="5"/><circle cx="246" cy="95" r="4"/><circle cx="300" cy="68" r="5"/><circle cx="318" cy="124" r="4"/></g><path d="M36 82h274" stroke="#e8f4f2" stroke-width="5" opacity=".45"/>`),
  'sandstorm.svg': scene('Bad Weather', `${coach}<path d="M22 74c76 22 133-18 207 4s82-3 112 6M18 106c72 18 137-17 210 3s82-7 113 7" fill="none" stroke="#e0b369" stroke-width="7" opacity=".72"/>`),
  'inside-leak.svg': scene('Inside Leak', `${strongbox}<g filter="url(#shadow)"><path d="M91 90h72v82H91z" fill="#213238" stroke="#e0b45d" stroke-width="3"/><path d="M104 111h46M104 128h38M104 145h50" stroke="#ffe2a2" stroke-width="4"/></g><path d="M178 112c38-16 68-13 96 12" fill="none" stroke="#f06f4e" stroke-width="5" stroke-dasharray="8 8"/>`),
  'rival-sabotage.svg': scene('Rival Sabotage', `${train}<path d="M246 92l42 34-18 36" fill="none" stroke="#f06f4e" stroke-width="6" stroke-linecap="round"/><path d="M246 92l-10 26M246 92l28-4" stroke="#ffe7a6" stroke-width="4"/><g fill="#171014"><circle cx="294" cy="91" r="12"/><path d="M281 104h25l-7 46h-12z"/></g>`),
  'telegraph-cut.svg': scene('Telegraph Cut', `${telegraph}<path d="M247 88l44 48M290 88l-46 48" stroke="#f06f4e" stroke-width="6" stroke-linecap="round"/>`),
  'telegraph-warning.svg': scene('Telegraph Sparks', `${telegraph}<path d="M206 72l22 15-24 10 28 15-31 12" fill="none" stroke="#ffeaa7" stroke-width="5" stroke-linecap="round"/><circle cx="232" cy="92" r="18" fill="#ffeaa7" opacity=".18"/>`),
  'decoy-success.svg': scene('Decoy Success', `${strongbox}<g filter="url(#shadow)"><rect x="232" y="138" width="56" height="32" rx="5" fill="#3a241b" stroke="#e0b45d" stroke-width="3"/><path d="M241 154h38" stroke="#ffe7a6" stroke-width="4"/></g><path d="M211 147c32-30 63-32 90-2" fill="none" stroke="#ffe7a6" stroke-width="5" stroke-dasharray="9 8"/>`),
  'false-tip.svg': scene('False Local Rumor', `${coach}<g filter="url(#shadow)"><path d="M62 92h76v58H62z" fill="#ead7a6" stroke="#e0b45d" stroke-width="4"/><path d="M76 111h45M76 128h32" stroke="#4a2d13" stroke-width="4"/><path d="M121 92l20 15-20 15" fill="#7d2e24" stroke="#ffbd77" stroke-width="3"/></g><path d="M169 98c32-22 69-18 102 7" fill="none" stroke="#f06f4e" stroke-width="6" stroke-dasharray="10 8"/>`),
  'failed-delivery.svg': scene('Failed Delivery', `${coach}<path d="M120 100l126 78M246 100l-126 78" stroke="#f06f4e" stroke-width="11" stroke-linecap="round" opacity=".8"/><path d="M72 171h214" stroke="#15110d" stroke-width="6" stroke-linecap="round"/>`)
};

await fs.mkdir(outDir, { recursive: true });
await Promise.all(Object.entries(scenes).map(([name, svg]) => fs.writeFile(path.join(outDir, name), svg, 'utf8')));
console.log(`Generated ${Object.keys(scenes).length} event scene SVGs.`);
