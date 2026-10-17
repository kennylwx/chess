import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = process.argv[2];
if (!output) throw new Error('Usage: node prepare-cli-package.mjs OUTPUT_DIRECTORY');
const destination = resolve(output);
const source = resolve('apps/cli');
const manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
const { devDependencies: _devDependencies, scripts: _scripts, ...publishManifest } = manifest;

await Promise.all([mkdir(destination, { recursive: true }), mkdir(resolve(destination, 'dist'), { recursive: true })]);
await Promise.all([
  cp(resolve(source, 'bin'), resolve(destination, 'bin'), { recursive: true }),
  cp(resolve(source, 'dist/cli.bundle.js'), resolve(destination, 'dist/cli.bundle.js')),
  cp(resolve(source, 'dist/cli.bundle.js.map'), resolve(destination, 'dist/cli.bundle.js.map')),
  cp(resolve(source, 'README.md'), resolve(destination, 'README.md')),
  cp(resolve(source, 'LICENSE'), resolve(destination, 'LICENSE')),
]);
await writeFile(resolve(destination, 'package.json'), `${JSON.stringify(publishManifest, null, 2)}\n`);
