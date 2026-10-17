# Chess

Play chess against Stockfish in your browser or terminal. Enter chess notation
or describe your move in plain English.

## Setup

Install Node.js 22.12+ and pnpm 10. For the browser or plain-English moves, also
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

The browser server requires a separate Stockfish installation. Set
`STOCKFISH_PATH` in `.env` if it isn't on your `PATH`.

```sh
pnpm dev
```

Leave this running and open http://localhost:5173. You play as White. Enter a
move and Stockfish replies automatically. Adjust the ELO field to change the
difficulty (1320–3190).

## Play in your terminal

Install the `chess` command:

```sh
pnpm cli:install
chess --elo 1500
```

If pnpm asks you to set up its global bin directory, run `pnpm setup`, restart
your terminal, and retry `pnpm cli:install`.

Or run it directly from the project folder with `pnpm chess --elo 1500`.
Stockfish runs locally; no server or separate engine installation is needed.
For plain-English moves, keep `pnpm dev` running in another terminal.

The board updates in place as you play, with a single row of algebraic moves
(such as `1. e4 e5 2. Nf3 Nc6`) underneath. `quit` or Ctrl+C restores your terminal.
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
