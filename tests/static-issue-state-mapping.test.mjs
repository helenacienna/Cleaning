import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('app-data issue mapping does not reference stale local hasOpenIssue variable', async () => {
  const source = await readFile(new URL('../lib/app-data.js', import.meta.url), 'utf8');

  assert.equal(source.includes('      hasOpenIssue,\n'), false);
  assert.equal(source.includes('...issueState'), true);
});
