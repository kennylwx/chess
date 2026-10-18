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
npm install --global @chess/cli
chess
```

## Release the CLI

```sh
gh workflow run release.yml --ref main -f version_bump=patch -f release_channel=production
gh pr list --state open
```

Merge the generated release PR to publish. Use `minor` or `major` for the version bump, or `alpha` or `beta` for a prerelease.
