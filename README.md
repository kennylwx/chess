# Chess

Play chess against Stockfish in your browser or terminal. Enter chess notation
or describe your move in plain English.

## Setup

Install Node.js 22.13+ and pnpm 10. For the browser or plain-English moves, also
install Python 3.12 and [uv](https://docs.astral.sh/uv/). From the project folder:

```sh
pnpm install
pnpm run setup
```

Setup installs the Python dependencies and creates `.env` from `.env.example`
without overwriting an existing file. Add your `TYPESAFE_API_KEY` to `.env` for
plain-English moves. For terminal-only play with chess notation, you can skip
`pnpm run setup`. Stockfish is included with the CLI.

## Play in your browser

The website runs its bundled Stockfish engine in your browser. The server is only
needed for plain-English move instructions.

```sh
pnpm dev
```

Leave this running and open http://localhost:5173. The full-page terminal starts
with the same Play / Load menu as the CLI. Use the numbered keys, B to go back,
and Q to end the session. Play offers five Stockfish strength presets,
a custom ELO from 1320 to 3190, and White, Black, or a random side. Games save
automatically in this browser and can be loaded from the menu. Enter a move and
Stockfish replies automatically.

For Vercel, import this repository into the zenhix team with the project root
set to `apps/web`. The included `apps/web/vercel.json` builds the web app and
serves its `dist` directory. Stockfish and notation work without a server.
To enable plain-English moves in production, set `VITE_CHESS_SERVER_URL` to a
deployed Chess server URL in the Vercel project and redeploy.

## Play in your terminal

Install the `chess` command:

```sh
pnpm cli:install
chess
```

If pnpm asks you to set up its global bin directory, run `pnpm setup`, restart
your terminal, and retry `pnpm cli:install`.

Or run it directly from the project folder with `pnpm chess`.
The start menu lets you play, choose any Stockfish ELO from 1320 to 3190, or
load a previous game. Choose one of the five numbered ELO presets, or `6` to
enter a custom rating from 1320 to 3190. Then choose `1` for White, `2` for
Black, or `3` for a random side. Press `B` to go back or `Q` to quit on any
screen. Enter is only needed for the custom ELO value.
Games save automatically in `~/.local/share/chess/games.sqlite` using SQLite.
Stockfish runs locally; no server or separate engine installation is needed.
For plain-English moves, keep `pnpm dev` running in another terminal.

After a release, install the published CLI with `npm install --global @chess/cli`
or install the Homebrew formula from the release page. Both install Stockfish
alongside the CLI; Node.js 22.13 or newer is required.

The board updates in place as you play, with a single row of algebraic moves
(such as `1. e4 e5 2. Nf3 Nc6`) in the shaded header. The shaded footer shows
the latest status. `quit` returns you to the menu; Ctrl+C exits and restores your terminal.
Ghostty and Kitty show a large green board with illustrated pieces automatically.
Use `--graphics text` for the text board or `--graphics kitty` to force images in
another terminal that supports the Kitty graphics protocol.

Add `--color black` to play as Black, `--server URL` to use another server, or
`--help` to see all options.

## Moves and commands

Enter a move such as `e2e4`, `Nf3`, or `move the pawn from e2 to e4`.
Notation must match exactly, including `x` for captures and `+`/`#` for check.
Unrecognized moves show up to five legal suggestions based on your input.
Type a suggestion to play it; suggestions never move a piece automatically.

- `help` — show available commands.
- **Ctrl+U** or `undo` — take back your move and Stockfish’s reply, even while it is thinking.
- `fen` — show the current position as FEN.
- `new` — start a new game (browser only).
- `fen <position>` — load a FEN position (terminal only).
- `quit` — exit (terminal only).
