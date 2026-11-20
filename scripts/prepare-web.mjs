import { mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const output = resolve(root, 'www');
const requiredFiles = [
  'index.html',
  'supabase-adapter.js',
  'supabase-compat.js',
  'vibesnap-extras.js',
  'vibesnap-desktop-extras.js'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of requiredFiles) {
  const source = resolve(root, file);
  const destination = resolve(output, file);
  await copyFile(source, destination);
  console.log(`Prepared ${file}`);
}

console.log('VibeSnap web assets are ready in ./www');
