# ZChess CLI

Play chess against the Stockfish engine from your terminal. The published
package includes the CLI and installs Stockfish automatically.

```sh
npm install --global zchess
chess
```

Requires Node.js 22.13 or newer. The menu lets you choose a skill level and
color, or load a saved game. Games are saved in
`~/.local/share/zchess/games.sqlite`.

You can also install with Homebrew from a release:

```sh
brew install --formula https://github.com/kennylwx/zchess/releases/latest/download/zchess.rb
```

Stockfish runs locally. Plain-English move descriptions need the Chess server;
SAN and UCI moves work offline.

Terminal graphics default to `--graphics auto`: the CLI probes the active terminal
for Kitty graphics support before enabling images. Environment names alone do not
enable images. Unsupported terminals, redirected streams, tmux and screen use the
text board. `--graphics text` skips probing; `--graphics kitty` explicitly forces
the protocol on an interactive terminal (use only if you know it supports it).

The board uses the terminal's aspect-preserving fit within the available rows and
columns, rather than a font-specific cell ratio. Resizing redraws the board; help,
returning to menus and exit delete the board image. If the native PNG renderer
cannot load, play continues with the text board. A protocol response establishes
capability, not visual correctness in every terminal/version.
