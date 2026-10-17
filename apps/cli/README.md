# Chess CLI

Play chess against the Stockfish engine from your terminal. The published
package includes the CLI and installs Stockfish automatically.

```sh
npm install --global @chess/cli
chess
```

Requires Node.js 22.13 or newer. The menu lets you choose a skill level and
color, or load a saved game. Games are saved in
`~/.local/share/chess/games.sqlite`.

You can also install with Homebrew from a release:

```sh
brew install --formula https://github.com/kennylwx/chess/releases/latest/download/chess-cli.rb
```

Stockfish runs locally. Plain-English move descriptions need the Chess server;
SAN and UCI moves work offline.
