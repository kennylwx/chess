import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@chess/chess';
import { modelInput } from '@chess/chess/interaction';

test('commands require a slash while plain words are treated as move descriptions', async () => {
  const chess = new Chess();
  const messages = [];
  const server = { resolve: async (text) => { messages.push(text); return { move: 'e2e4', fen: chess.fen(), explanation: '' }; } };

  assert.equal((await modelInput('/help', chess)).type, 'help');
  assert.equal((await modelInput('/undo', chess)).type, 'undo');
  assert.equal((await modelInput('/quit', chess)).type, 'quit');
  assert.equal((await modelInput('/fen', chess)).type, 'show-fen');
  assert.equal((await modelInput('/fen 8/8/8/8/8/8/8/K6k w - - 0 1', chess)).type, 'load-fen');

  for (const text of ['help', 'undo', 'quit']) await modelInput(text, chess, server);
  assert.deepEqual(messages, ['help', 'undo', 'quit']);
});

test('unknown slash commands produce command guidance instead of becoming move text', async () => {
  await assert.rejects(modelInput('/bogus', new Chess()), /Unknown command: \/bogus.*\/help/);
});
