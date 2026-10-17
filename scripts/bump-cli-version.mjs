import { readFile, writeFile } from 'node:fs/promises';

const [bump, channel] = process.argv.slice(2);
const bumps = { patch: 2, minor: 1, major: 0 };
if (!(bump in bumps) || !['alpha', 'beta', 'production'].includes(channel)) {
  throw new Error('Usage: node bump-cli-version.mjs <patch|minor|major> <alpha|beta|production>');
}

const packagePath = new URL('../apps/cli/package.json', import.meta.url);
const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?$/.exec(manifest.version);
if (!match) throw new Error(`Cannot bump invalid CLI version: ${manifest.version}`);

const parts = match.slice(1).map(Number);
const bumpIndex = bumps[bump];
parts[bumpIndex] += 1;
for (let index = bumpIndex + 1; index < parts.length; index += 1) parts[index] = 0;

const stableVersion = parts.join('.');
manifest.version = channel === 'production' ? stableVersion : `${stableVersion}-${channel}.0`;
await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${manifest.version}\n`);
