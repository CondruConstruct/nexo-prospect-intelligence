# QR Forever prepared API

**Source only: not deployed; no database or photo storage has been created or connected.**
The static website can operate independently. This API intentionally cannot upload, list or download photos, including when a D1 database is connected. Every photo endpoint returns `503 STORAGE_NOT_CONFIGURED`. Guest deletion returns `403 GUEST_DELETE_FORBIDDEN`.

## Environment when metadata hosting is authorized

- `DB`: Cloudflare D1 binding with `migrations/0001_events.sql` applied.
- `ADMIN_TOKEN`: administrator secret, at least 32 characters, generated securely and set as a server secret. Never put it in source, browser configuration, localStorage, a URL, or a public deployment variable. A future browser admin form should hold it only in memory for the current session.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins, e.g. `https://events.example.com`. No wildcard, trailing slash, path, or non-local HTTP origins. Requests without an allowed `Origin` fail closed; this includes CLI requests unless they set the header. Origin checking is a browser protection, not authentication.

The frontend's future `API_BASE` is the Worker origin followed by `/api`. Keep it empty until a real metadata API exists. No Worker deployment configuration is supplied, to avoid implying that hosting is ready.

## Routes

All responses use `Cache-Control: no-store`. Errors have `{ "error": "CODE" }`.

| Method | Route | Input / result |
| --- | --- | --- |
| GET | `/api/health` | Prepared status; storage and uploads always false |
| POST | `/api/admin/events` | `{name,eventDate,quotaGB,retentionDays}`; returns `{event,guestToken,guestPath}` |
| GET | `/api/admin/events?limit=30&before=...` | `{events,nextCursor}`; cursor must be URL-encoded; limit 1–100 |
| PATCH | `/api/admin/events/:id` | Any nonempty subset of `{name,quotaGB,expiresAt,disabled}`; returns `{event}` |
| GET | `/api/events/:guestToken` | Guest-safe `{event}` metadata; no public event listing |
| Any | `/api/events/:guestToken/photos/...`, `/upload/...`, `/download/...` | Storage unavailable; body never consumed or stored; DELETE forbidden |

Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`. Guest links grant viewing/downloading/uploading rights only after a future storage implementation; they grant no admin rights.

`eventDate` is a real `YYYY-MM-DD` calendar date, no later than ten years from creation. Retention begins at **the end of that event date in UTC**, not at creation. `retentionDays` is an integer from 1 to 3,650. Creation rejects a resulting expiry already in the past. For example an event on 2026-10-01 with 30 days expires at 2026-10-31T23:59:59.999Z. The frontend should disclose the UTC policy consistently. `quotaGB` is a whole number 1–1,000 and one GB is 1,000,000,000 bytes. `expiresAt` updates require exact ISO UTC with milliseconds and a future time. Updating the display event date is intentionally unsupported; an expiry can be adjusted explicitly.

Admin metadata fields: `id`, `name`, `eventDate`, `quotaBytes`, `usedBytes`, `expiresAt`, `disabled`, `createdAt`, `updatedAt`, `storageConfigured`, `uploadsEnabled`, `downloadsEnabled`. Guest metadata omits `id`, `disabled`, `createdAt`, `updatedAt`. The final three capability booleans are always false. `usedBytes` represents committed stored photos and remains zero in this prepared implementation.

## Private-link handling

Creation draws 32 cryptographically random bytes (256 bits), returns a base64url token once, and stores only its SHA-256 hash. `guestPath` is `/album.html#event=<token>`; URL fragments are excluded from frontend hosting requests and normal referrers. **The administrator must copy/save the link immediately; listing events cannot recover it.** Token recovery or rotation needs a separate intentional future endpoint. Do not log guest tokens, Authorization headers, request bodies, or full guest API URLs. API paths do carry the token when the frontend calls metadata; provider/access logging must be configured accordingly before enabling private links. Do not place third-party analytics/scripts on the private album page. Anyone who receives the link can pass it to someone else; it is a bearer capability, not an identified guest login.

Expired, disabled and unknown links all return the same 404 response. Secrets are checked through a fixed-length SHA-256 digest loop without an early-exit comparison (JavaScript runtimes do not offer a formal timing guarantee). No photo bytes are read even for an authenticated event upload request. CORS allows only the specified frontend origins and headers.

## Future storage adapter contract — design only

Do not change `storageConfigured` to true until the entire flow below exists and passes integration checks. There is currently **no storage binding, adapter, signed-upload endpoint, photo table or cleanup job**.

1. `reserveUpload({eventId,idempotencyKey,declaredBytes,contentType})` must recheck active status/expiry, file count and per-file limits, and reserve bytes atomically with `usedBytes + reservedBytes + declaredBytes <= quotaBytes`. This requires a transaction/serialized event coordinator; a read-then-write quota check is unsafe. Reservations have a short expiry and owner-bound opaque IDs; a retry must not reserve twice. A future reservation table and atomic conditional SQL are required.
2. `putValidated({reservationId,body})` must enforce a streaming byte limit; validate magic bytes and decode the image using a trusted decoder, not merely MIME type or extension; reject HTML/SVG and other active content; enforce pixel/decompression limits; normalize supported formats and remove sensitive EXIF/GPS metadata according to the agreed policy. Quarantine pending uploads. Do not make uploaded data public before validation. HEIC support requires an actual decoder/normalization workflow and must not be advertised until tested.
3. `commitUpload({reservationId,objectKey,actualBytes,metadata})` must atomically consume the reservation and record verified actual bytes once. Roll back failed writes and reconcile orphan objects/reservations. Never allow direct object keys or arbitrary external URLs from a client. Race tests must cover simultaneous uploads, expiry, disabling, retries, quota reduction and validation failure.
4. `listPhotos({eventId,cursor,limit})` must verify the private event token on every call, filter strictly by event, use stable cursor pagination, and return safe metadata plus short-lived event-scoped download capabilities. Keep the object store private. `downloadPhoto({eventId,photoId})` must recheck event availability and photo membership and supply safe content disposition and content type. ZIP export needs bounded asynchronous jobs and must recheck expiry; do not promise it beforehand.
5. `deletePhoto` may be callable only through administrator authorization. Guests have no deletion endpoint. Admin deletion must keep metadata, object removal, and used-byte counters consistent and idempotent.
6. `expireEvents({now,batchLimit,cursor})` must immediately block access at expiry regardless of cleanup delay, then retry idempotent paginated object deletion and reservation release. Define and disclose the actual deletion SLA, backup retention and lifecycle rules before launch. No automatic deletion or legal retention guarantee is currently implemented.
7. Before public enablement, add request/upload rate limits, abuse reporting and moderation, storage monitoring, billing limits, backups/recovery policy, deployment verification and a real two-device upload/download test. API database queries currently run against D1 only when explicitly bound; tests below use a local in-memory SQLite adapter.

## Verify locally

Requires Node 24 (built-in `node:sqlite`; no external packages):

```powershell
npm test
```

Tests cover origin and authentication boundaries, inactive event access, secret non-disclosure, 256-bit token creation, retention anchored to the event date, malformed inputs, request size limits, guest deletion denial, upload bodies remaining unread, quota reductions and actual migration/SQL against in-memory SQLite. They create no cloud resources and store no photos.
