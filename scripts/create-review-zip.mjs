import { deflateRawSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const versionTag = `v${packageJson.version.replace(/\./g, '')}`;
const zipName = `dead-mans-ledger-${versionTag}-review.zip`;
const zipPath = path.join(root, zipName);

const includeDirs = ['.github', 'docs', 'public', 'scripts', 'src'];
const includeFiles = [
  '.gitignore',
  'index.html',
  'LICENSE',
  'NOTICE.md',
  'package.json',
  'package-lock.json',
  'README.md',
  'tsconfig.json',
  'vite.config.ts',
  `BALANCE_REPORT_DEAD_MANS_LEDGER_${versionTag.toUpperCase()}.md`,
  `ROUTE_GENERATION_INTEGRITY_REPORT_${versionTag.toUpperCase()}.md`,
  `PLAYTEST_REPORT_DEAD_MANS_LEDGER_${versionTag.toUpperCase()}.md`,
  `BUILD_RECEIPT_DEAD_MANS_LEDGER_${versionTag.toUpperCase()}.md`,
  `BUILD_LOG_DEAD_MANS_LEDGER_${versionTag.toUpperCase()}.txt`
];

const forbiddenPattern = /(^|\/)(node_modules|dist|\.git|\.vite|coverage|\.tmp|cache|\.cache|playwright-report|\.playwright-cli)(\/|$)|\.zip$|preview-v.*\.log$/i;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function archiveName(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

async function collectFiles() {
  const files = [];
  for (const dir of includeDirs) {
    const fullPath = path.join(root, dir);
    if (await exists(fullPath)) {
      files.push(...(await walk(fullPath)));
    }
  }
  for (const file of includeFiles) {
    const fullPath = path.join(root, file);
    if (await exists(fullPath)) {
      files.push(fullPath);
    }
  }
  const screenshotDir = path.join(root, 'output', 'playwright');
  if (await exists(screenshotDir)) {
    for (const file of await walk(screenshotDir)) {
      if (archiveName(file).includes(versionTag) && file.endsWith('.png')) {
        files.push(file);
      }
    }
  }
  return [...new Map(files.map((file) => [archiveName(file), file])).values()].sort((a, b) => archiveName(a).localeCompare(archiveName(b)));
}

function validateArchiveNames(names) {
  const backslashEntries = names.filter((name) => name.includes('\\'));
  const forbiddenEntries = names.filter((name) => forbiddenPattern.test(name));
  if (backslashEntries.length || forbiddenEntries.length) {
    throw new Error(
      [
        backslashEntries.length ? `Backslash entries: ${backslashEntries.join(', ')}` : '',
        forbiddenEntries.length ? `Forbidden entries: ${forbiddenEntries.join(', ')}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
}

async function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = archiveName(file);
    const nameBuffer = Buffer.from(name, 'utf8');
    const data = await fs.readFile(file);
    const compressed = deflateRawSync(data, { level: 9 });
    const useCompressed = compressed.length < data.length;
    const payload = useCompressed ? compressed : data;
    const method = useCompressed ? 8 : 0;
    const stats = await fs.stat(file);
    const { dosTime, dosDate } = dosDateTime(stats.mtime);
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuffer.length),
      u16(0),
      nameBuffer
    ]);

    localParts.push(localHeader, payload);

    const centralHeader = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuffer.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuffer
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0)
  ]);

  await fs.writeFile(zipPath, Buffer.concat([...localParts, centralDirectory, endRecord]));
}

const files = await collectFiles();
const names = files.map(archiveName);
validateArchiveNames(names);
await fs.rm(zipPath, { force: true });
await buildZip(files);
validateArchiveNames(names);

console.log(`Created ${zipPath}`);
console.log(`Entries: ${names.length}`);
console.log(`Screenshots: ${names.filter((name) => name.startsWith('output/playwright/') && name.endsWith('.png')).length}`);
console.log('Portable path validation: PASS');
