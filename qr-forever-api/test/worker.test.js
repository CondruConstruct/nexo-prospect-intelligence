import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { constantTimeEqual } from '../src/worker.js';

const origin = 'https://example.com';
const secret = 'a-very-long-admin-secret-for-tests-123456';
const token = 'A'.repeat(43);
const eventDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const row = { id: '16f090b2-8b9d-4e60-9b42-b6e313324a94', name: 'Wedding', event_date: eventDate, quota_bytes: 5e9,
  used_bytes: 0, expires_at: '2099-01-01T00:00:00.000Z', disabled: 0, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', token_hash: 'private-hash' };
function database(event = row) {
  const calls = [];
  return { calls, prepare(sql) {
    const query = { sql, args: [] };
    calls.push(query);
    return { bind(...args) {
      query.args = args;
      return { first: async () => event && { ...event }, all: async () => ({ results: event ? [{ ...event }] : [] }), run: async () => ({ success: true, meta: { changes: 1 } }) };
    } };
  } };
}
function env(DB = database()) { return { ALLOWED_ORIGINS: origin, ADMIN_TOKEN: secret, DB }; }
function req(path, options = {}) {
  return new Request(`https://api.example.com/api${path}`, { ...options, headers: { Origin: origin, ...options.headers } });
}
function admin(path, method, data) {
  return req(path, { method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}
test('fixed-length digest comparison authenticates only the exact secret', async () => {
  assert.equal(await constantTimeEqual(secret, secret), true);
  assert.equal(await constantTimeEqual(secret, secret + 'x'), false);
  assert.equal(await constantTimeEqual(secret, secret.slice(0, -1)), false);
});
test('untrusted or missing origin cannot reach database or receive CORS permission', async () => {
  const DB = database();
  for (const headers of [{}, { Origin: 'https://example.com.attacker.test' }, { Origin: 'null' }]) {
    const result = await worker.fetch(new Request('https://api.example.com/api/admin/events', { headers }), env(DB));
    assert.equal(result.status, 403);
    assert.equal(result.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(DB.calls.length, 0);
});
test('unauthorized admin attempts cannot list or mutate metadata', async () => {
  const DB = database();
  for (const authorization of ['', `Bearer ${secret}x`, `Basic ${secret}`, `bearer ${secret}`]) {
    const result = await worker.fetch(req('/admin/events', { headers: { Authorization: authorization } }), env(DB));
    assert.equal(result.status, 401);
  }
  assert.equal(DB.calls.length, 0);
});
test('weak or absent admin configuration fails closed', async () => {
  const result = await worker.fetch(admin('/admin/events', 'GET'), { ...env(), ADMIN_TOKEN: 'short' });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error, 'ADMIN_NOT_CONFIGURED');
});
test('guest metadata never leaks administrator identifiers or token hashes', async () => {
  const result = await worker.fetch(req(`/events/${token}`), env());
  assert.equal(result.status, 200);
  const { event } = await result.json();
  assert.deepEqual(Object.keys(event).sort(), ['downloadsEnabled', 'eventDate', 'expiresAt', 'name', 'quotaBytes', 'storageConfigured', 'uploadsEnabled', 'usedBytes'].sort());
  assert.equal(event.uploadsEnabled, false);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});
test('disabled, expired and nonexistent guest events all return the same unavailable response', async () => {
  for (const value of [null, { ...row, disabled: 1 }, { ...row, expires_at: '2000-01-01T00:00:00.000Z' }]) {
    const result = await worker.fetch(req(`/events/${token}`), env(database(value)));
    assert.equal(result.status, 404);
    assert.deepEqual(await result.json(), { error: 'EVENT_UNAVAILABLE' });
  }
});
test('upload requests fail closed without reading bytes or writing metadata', async () => {
  const DB = database();
  const request = req(`/events/${token}/photos/upload`, { method: 'POST', body: 'private photo bytes' });
  const result = await worker.fetch(request, env(DB));
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: 'STORAGE_NOT_CONFIGURED' });
  assert.equal(request.bodyUsed, false);
  assert.equal(DB.calls.length, 1);
  assert.match(DB.calls[0].sql, /^SELECT /);
});
test('download/list routes fail closed and guest deletion is forbidden', async () => {
  for (const path of ['/photos', '/photos/p1/download', '/download', '/upload']) {
    const result = await worker.fetch(req(`/events/${token}${path}`), env());
    assert.equal(result.status, 503);
  }
  const result = await worker.fetch(req(`/events/${token}/photos/p1`, { method: 'DELETE' }), env());
  assert.equal(result.status, 403);
  assert.equal((await result.json()).error, 'GUEST_DELETE_FORBIDDEN');
});
test('there is no public event listing', async () => {
  const DB = database();
  const result = await worker.fetch(req('/events'), env(DB));
  assert.equal(result.status, 404);
  assert.equal(DB.calls.length, 0);
});
test('creation generates unique 256-bit tokens but persists only their hash', async () => {
  const DB = database();
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const result = await worker.fetch(admin('/admin/events', 'POST', { name: '  Summer event  ', eventDate, quotaGB: 5, retentionDays: 30 }), env(DB));
    assert.equal(result.status, 201);
    const body = await result.json();
    assert.match(body.guestToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(body.guestToken, 'base64url').length, 32);
    assert.equal(body.event.name, 'Summer event');
    assert.equal(body.event.quotaBytes, 5e9);
    assert.equal(body.event.storageConfigured, false);
    assert.equal(body.event.expiresAt, new Date(Date.parse(`${eventDate}T23:59:59.999Z`) + 30 * 86400000).toISOString());
    assert.equal(body.guestPath, `/album.html#event=${body.guestToken}`);
    tokens.push(body.guestToken);
    assert.equal(JSON.stringify(DB.calls).includes(body.guestToken), false);
  }
  assert.notEqual(tokens[0], tokens[1]);
  assert.match(DB.calls[0].args[1], /^[a-f0-9]{64}$/);
});
test('invalid event settings never write to database', async () => {
  const DB = database();
  const valid = { name: 'Wedding', eventDate, quotaGB: 5, retentionDays: 30 };
  for (const data of [ { ...valid, name: '' }, { ...valid, name: 'a\u0000b' }, { ...valid, quotaGB: 0 }, { ...valid, quotaGB: 1.5 },
    { ...valid, quotaGB: '5' }, { ...valid, retentionDays: 0 }, { ...valid, retentionDays: 3651 }, { ...valid, guestToken: token },
    { ...valid, eventDate: '2026-02-30' }, { ...valid, eventDate: '2000-01-01' } ]) {
    const result = await worker.fetch(admin('/admin/events', 'POST', data), env(DB));
    assert.equal(result.status, 400);
  }
  assert.equal(DB.calls.length, 0);
});
test('oversized streamed JSON is rejected even without content-length', async () => {
  const result = await worker.fetch(admin('/admin/events', 'POST', { name: 'a'.repeat(5000) }), env());
  assert.equal(result.status, 413);
});
test('admin cannot reduce quota below existing usage', async () => {
  const DB = database({ ...row, used_bytes: 2e9 });
  const result = await worker.fetch(admin(`/admin/events/${row.id}`, 'PATCH', { quotaGB: 1 }), env(DB));
  assert.equal(result.status, 409);
  assert.equal(DB.calls.some(call => call.sql.startsWith('UPDATE')), false);
});
test('database exceptions do not expose token or internal error', async () => {
  const result = await worker.fetch(req(`/events/${token}`), env({ prepare() { throw new Error(`secret ${token}`); } }));
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: 'SERVICE_UNAVAILABLE' });
});
test('preflight permits only expected methods and request headers', async () => {
  const result = await worker.fetch(req('/admin/events', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'authorization, content-type' } }), env());
  assert.equal(result.status, 204);
  const forbidden = await worker.fetch(req('/admin/events', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'PUT' } }), env());
  assert.equal(forbidden.status, 403);
});
