import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';

test('real migration and SQL support create, pagination, update, disable and private access', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_events.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { return { bind(...params) {
    const statement = sqlite.prepare(sql);
    return { first: async () => statement.get(...params) || null,
      all: async () => ({ results: statement.all(...params) }),
      run: async () => ({ meta: { changes: statement.run(...params).changes } }) };
  } }; } };
  const secret = 'sqlite-test-admin-secret-at-least-32-chars';
  const origin = 'https://example.com';
  const env = { DB, ADMIN_TOKEN: secret, ALLOWED_ORIGINS: origin };
  async function call(path, method = 'GET', data) {
    return worker.fetch(new Request(`https://api.example.com/api${path}`, {
      method, headers: { Origin: origin, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }), env);
  }
  try {
    const eventDate = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const created = [];
    for (const name of ['Wedding', 'Anniversary']) {
      const response = await call('/admin/events', 'POST', { name, eventDate, quotaGB: 5, retentionDays: 30 });
      assert.equal(response.status, 201);
      created.push(await response.json());
    }
    const page1 = await (await call('/admin/events?limit=1')).json();
    assert.equal(page1.events.length, 1);
    assert.ok(page1.nextCursor);
    const page2 = await (await call(`/admin/events?limit=1&before=${encodeURIComponent(page1.nextCursor)}`)).json();
    assert.equal(page2.events.length, 1);
    assert.equal(page2.nextCursor, null);
    assert.notEqual(page1.events[0].id, page2.events[0].id);
    const first = created[0];
    let result = await call(`/events/${first.guestToken}`);
    assert.equal(result.status, 200);
    result = await call(`/admin/events/${first.event.id}`, 'PATCH', { name: 'Renamed', quotaGB: 10, disabled: true });
    assert.equal(result.status, 200);
    const updated = (await result.json()).event;
    assert.equal(updated.name, 'Renamed');
    assert.equal(updated.quotaBytes, 10e9);
    assert.equal(updated.disabled, true);
    assert.equal((await call(`/events/${first.guestToken}`)).status, 404);
    assert.equal((await call(`/events/${created[1].guestToken}`)).status, 200);
    const stored = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(first.event.id);
    assert.equal(JSON.stringify(stored).includes(first.guestToken), false);
    assert.equal(stored.used_bytes, 0);
  } finally { sqlite.close(); }
});
