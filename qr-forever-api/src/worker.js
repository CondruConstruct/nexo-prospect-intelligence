// Prepared API: no bucket binding, photo adapter, or deployment is included.
const GB = 1_000_000_000;
const DAY = 86_400_000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const enc = new TextEncoder();

class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
function fail(status, code) { throw new ApiError(status, code); }
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}
export async function constantTimeEqual(a, b) {
  // Always compare fixed-length digests; no early-exit comparison of secrets.
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
async function tokenHash(value) {
  return [...await digest(value)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function guestToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function configuredOrigins(env) {
  const values = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!values.length) fail(503, 'API_NOT_CONFIGURED');
  for (const value of values) {
    let url;
    try { url = new URL(value); } catch { fail(503, 'API_NOT_CONFIGURED'); }
    if (url.origin !== value || !['https:', 'http:'].includes(url.protocol)) fail(503, 'API_NOT_CONFIGURED');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) fail(503, 'API_NOT_CONFIGURED');
  }
  return values;
}
function response(status, data, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}
async function json(request) {
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'JSON_REQUIRED');
  if (Number(request.headers.get('content-length')) > 4096) fail(413, 'BODY_TOO_LARGE');
  if (!request.body) fail(400, 'INVALID_JSON');
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) { await reader.cancel(); fail(413, 'BODY_TOO_LARGE'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(400, 'INVALID_JSON'); }
  if (!data || Array.isArray(data) || typeof data !== 'object') fail(400, 'INVALID_JSON');
  return data;
}
function name(value) {
  if (typeof value !== 'string') fail(400, 'INVALID_NAME');
  const clean = value.trim();
  if (!clean || [...clean].length > 120 || /[\u0000-\u001f\u007f]/.test(clean)) fail(400, 'INVALID_NAME');
  return clean;
}
function quota(value) {
  if (!Number.isInteger(value) || value < 1 || value > 1000) fail(400, 'INVALID_QUOTA_GB');
  return value * GB;
}
function unknownFields(data, allowed) {
  if (Object.keys(data).some(key => !allowed.includes(key))) fail(400, 'UNKNOWN_FIELD');
}
function eventDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) fail(400, 'INVALID_EVENT_DATE');
  const date = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value || date > Date.now() + 3650 * DAY) fail(400, 'INVALID_EVENT_DATE');
  return value;
}
function expiry(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) fail(400, 'INVALID_EXPIRY');
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value || time <= Date.now() || time > Date.now() + 7301 * DAY) fail(400, 'INVALID_EXPIRY');
  return value;
}
function metadata(row) {
  return {
    id: row.id, name: row.name, eventDate: row.event_date, quotaBytes: row.quota_bytes, usedBytes: row.used_bytes,
    expiresAt: row.expires_at, disabled: Boolean(row.disabled), createdAt: row.created_at,
    updatedAt: row.updated_at, storageConfigured: false, uploadsEnabled: false, downloadsEnabled: false,
  };
}
async function authenticate(request, env) {
  if (typeof env.ADMIN_TOKEN !== 'string' || env.ADMIN_TOKEN.length < 32) fail(503, 'ADMIN_NOT_CONFIGURED');
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 1024 || !(await constantTimeEqual(auth.slice(7), env.ADMIN_TOKEN))) fail(401, 'UNAUTHORIZED');
}
function db(env) { if (!env.DB) fail(503, 'METADATA_NOT_CONFIGURED'); return env.DB; }
async function route(request, env, url, origin) {
  const path = url.pathname;
  if (path === '/api/health' && request.method === 'GET') {
    return response(200, { status: 'prepared', storageConfigured: false, uploadsEnabled: false }, origin);
  }
  if (path.startsWith('/api/admin/')) {
    await authenticate(request, env);
    const database = db(env);
    if (path === '/api/admin/events' && request.method === 'POST') {
      const data = await json(request);
      unknownFields(data, ['name', 'eventDate', 'quotaGB', 'retentionDays']);
      const eventName = name(data.name);
      const date = eventDate(data.eventDate);
      const quotaBytes = quota(data.quotaGB);
      if (!Number.isInteger(data.retentionDays) || data.retentionDays < 1 || data.retentionDays > 3650) fail(400, 'INVALID_RETENTION_DAYS');
      const token = guestToken();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.parse(`${date}T23:59:59.999Z`) + data.retentionDays * DAY).toISOString();
      if (Date.parse(expiresAt) <= Date.now()) fail(400, 'EVENT_ALREADY_EXPIRED');
      const row = { id: crypto.randomUUID(), name: eventName, event_date: date, quota_bytes: quotaBytes, used_bytes: 0,
        expires_at: expiresAt, disabled: 0, created_at: now, updated_at: now };
      await database.prepare('INSERT INTO events (id, token_hash, name, event_date, quota_bytes, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(row.id, await tokenHash(token), row.name, date, row.quota_bytes, row.expires_at, now, now).run();
      return response(201, { event: metadata(row), guestToken: token, guestPath: `/album.html#event=${token}` }, origin);
    }
    if (path === '/api/admin/events' && request.method === 'GET') {
      if ([...url.searchParams.keys()].some(key => !['limit', 'before'].includes(key))) fail(400, 'INVALID_QUERY');
      const limitText = url.searchParams.get('limit') || '30';
      if (!/^\d{1,3}$/.test(limitText) || +limitText < 1 || +limitText > 100) fail(400, 'INVALID_LIMIT');
      const before = url.searchParams.get('before');
      let result;
      if (before) {
        // Cursor combines timestamp and ID to avoid skipping equal timestamps.
        const [timestamp, id, extra] = before.split('|');
        if (extra !== undefined || !ID.test(id || '') || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) fail(400, 'INVALID_CURSOR');
        result = await database.prepare('SELECT * FROM events WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT ?').bind(timestamp, timestamp, id, +limitText + 1).all();
      } else result = await database.prepare('SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT ?').bind(+limitText + 1).all();
      const rows = result.results.slice(0, +limitText);
      const last = rows.at(-1);
      return response(200, { events: rows.map(metadata), nextCursor: result.results.length > +limitText ? `${last.created_at}|${last.id}` : null }, origin);
    }
    const match = path.match(/^\/api\/admin\/events\/([^/]+)$/);
    if (match && ID.test(match[1]) && request.method === 'PATCH') {
      const data = await json(request);
      unknownFields(data, ['name', 'quotaGB', 'expiresAt', 'disabled']);
      if (!Object.keys(data).length) fail(400, 'EMPTY_UPDATE');
      const row = await database.prepare('SELECT * FROM events WHERE id = ?').bind(match[1]).first();
      if (!row) fail(404, 'EVENT_NOT_FOUND');
      if ('name' in data) row.name = name(data.name);
      if ('quotaGB' in data) row.quota_bytes = quota(data.quotaGB);
      if (row.quota_bytes < row.used_bytes) fail(409, 'QUOTA_BELOW_USAGE');
      if ('expiresAt' in data) row.expires_at = expiry(data.expiresAt);
      if ('disabled' in data) {
        if (typeof data.disabled !== 'boolean') fail(400, 'INVALID_DISABLED');
        row.disabled = Number(data.disabled);
      }
      row.updated_at = new Date().toISOString();
      // Conditional quota guard remains correct if usage changes concurrently.
      const result = await database.prepare('UPDATE events SET name = ?, quota_bytes = ?, expires_at = ?, disabled = ?, updated_at = ? WHERE id = ? AND used_bytes <= ?')
        .bind(row.name, row.quota_bytes, row.expires_at, row.disabled, row.updated_at, row.id, row.quota_bytes).run();
      if (!result.meta?.changes) fail(409, 'EVENT_CHANGED_RETRY');
      const updated = await database.prepare('SELECT * FROM events WHERE id = ?').bind(row.id).first();
      return response(200, { event: metadata(updated) }, origin);
    }
    fail(404, 'NOT_FOUND');
  }
  const guest = path.match(/^\/api\/events\/([^/]+)(\/.*)?$/);
  if (guest && TOKEN.test(guest[1])) {
    const row = await db(env).prepare('SELECT * FROM events WHERE token_hash = ?').bind(await tokenHash(guest[1])).first();
    // Same error for missing, disabled and expired private links.
    if (!row || row.disabled || Date.parse(row.expires_at) <= Date.now()) fail(404, 'EVENT_UNAVAILABLE');
    if (!guest[2] && request.method === 'GET') {
      const event = metadata(row);
      delete event.id; delete event.createdAt; delete event.updatedAt; delete event.disabled;
      return response(200, { event }, origin);
    }
    if (guest[2] && /^\/(photos|upload|download)(\/|$)/.test(guest[2])) {
      // Deliberately never read request.body and never write photo metadata/bytes.
      if (request.method === 'DELETE') fail(403, 'GUEST_DELETE_FORBIDDEN');
      fail(503, 'STORAGE_NOT_CONFIGURED');
    }
  }
  fail(404, 'NOT_FOUND');
}

export default {
  async fetch(request, env) {
    let origin;
    try {
      const allowed = configuredOrigins(env);
      const supplied = request.headers.get('origin');
      if (!supplied || !allowed.includes(supplied)) fail(403, 'ORIGIN_FORBIDDEN');
      origin = supplied;
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('access-control-request-method');
        const headers = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method) || headers.some(x => !['authorization', 'content-type'].includes(x))) fail(403, 'PREFLIGHT_FORBIDDEN');
        return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' } });
      }
      return await route(request, env, new URL(request.url), origin);
    } catch (error) {
      if (error instanceof ApiError) return response(error.status, { error: error.code }, origin);
      // Never expose database errors, private URLs, tokens or exception content.
      return response(503, { error: 'SERVICE_UNAVAILABLE' }, origin);
    }
  },
};
