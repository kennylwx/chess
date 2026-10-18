# Chess

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
npm install --global @kennylwx/cli
chess
```

## Release the CLI

```sh
gh workflow run release.yml --ref main -f version_bump=patch -f release_channel=production
```
