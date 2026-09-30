import { test } from 'node:test';
import assert from 'node:assert/strict';

const { default: handler } = await import('../netlify/functions/admin.mjs');
const post = (pin) => handler(new Request('https://x/api/admin', { method: 'POST', body: JSON.stringify({ pin }) }));

test('no ADMIN_PIN: page stays open', async () => {
  delete process.env.ADMIN_PIN;
  assert.deepEqual(await (await handler(new Request('https://x/api/admin'))).json(), { pinRequired: false });
  assert.equal((await post('anything')).status, 200);
});

test('ADMIN_PIN set: only the right PIN unlocks', async () => {
  process.env.ADMIN_PIN = '482913';
  assert.deepEqual(await (await handler(new Request('https://x/api/admin'))).json(), { pinRequired: true });
  assert.equal((await post('482913')).status, 200);
  assert.equal((await post('000000')).status, 401);
  assert.equal((await post(undefined)).status, 401);
});
