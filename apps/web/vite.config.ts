import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { readFileSync, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const engineRoot = dirname(require.resolve('stockfish/package.json'));
const files = new Map([
  ['stockfish-19-lite-single.js', join(engineRoot, 'bin/stockfish-19-lite-single.js')],
  ['stockfish-19-lite-single.wasm', join(engineRoot, 'bin/stockfish-19-lite-single.wasm')],
  ['LICENSE.txt', join(engineRoot, 'Copying.txt')],
]);

export default defineConfig({
  envDir: '../..',
  plugins: [{
    name: 'bundled-stockfish',
    configureServer(server) {
      server.middlewares.use('/engine', (request, response, next) => {
        const name = (request.url || '').split('?')[0].slice(1);
        const path = files.get(name);
        if (!path) return next();
        response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.js') ? 'text/javascript' : 'text/plain');
        createReadStream(path).pipe(response);
      });
    },
    generateBundle() {
      for (const [name, path] of files) this.emitFile({ type: 'asset', fileName: `engine/${name}`, source: readFileSync(path) });
    },
  }],
});
