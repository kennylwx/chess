# ZChess

## Run the website

```sh
pnpm install
pnpm run setup
pnpm dev
```

Open http://localhost:5173. Add `TYPESAFE_API_KEY` to `.env` for plain-English moves.

## Run the CLI

```sh
pnpm install
pnpm chess
```

## Install the published CLI

```sh
npm install --global zchess
chess
```

## Test

Run `pnpm test` for the workspace suite; Turbo builds dependencies before tests.
For a standalone chess package check, run `pnpm --filter @zchess/chess test:standalone`.
The package’s `test` script uses existing build output so parallel CLI consumers
never read files being rewritten by a test-time build.

## Release the CLI

```sh
gh workflow run release.yml --ref main -f version_bump=patch -f release_channel=production
```
