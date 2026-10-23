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
enable images. Unsupported terminals, redirected streams, tmux, screen and Konsole use the
text board. `--graphics text` skips probing; `--graphics kitty` explicitly forces
the protocol on an interactive terminal (use only if you know it supports it).

Konsole defaults to text because testing in 25.04.2 found that it acknowledged
Kitty queries but ignored the requested image sizing, clipping the board over
the input field. Forced Kitty mode can still exhibit this issue in Konsole.

The CLI queries cell pixel dimensions at startup and on image-board resize, then
specifies only one image dimension so the PNG stays square. If cell size is not
reported, sizing uses an approximate 2:1 cell ratio; image aspect is still preserved,
but available-space estimates can be less accurate with unusual fonts. The text
board also uses approximate proportions and depends on the terminal font.

Help, returning to menus and exit delete the board image. If the native PNG
renderer cannot load, play continues with the text board. A protocol response
establishes capability, not visual correctness in every terminal/version.
