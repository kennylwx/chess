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

When you start an interactive session, Chess checks npm for a newer version and
shows the command to install it in the main menu. Alpha installations also check
the alpha channel; stable installations only check stable releases. Homebrew
installations show a command to reinstall the latest release formula instead.
The check times out after 800 ms and failures are silent, so you can still play
offline. Set `ZCHESS_NO_UPDATE_CHECK=1` to disable it. Help and noninteractive
sessions do not check for updates. Updates are never installed automatically.
