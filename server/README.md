# QR Forever application server

This is the real administrator, private album and Backblaze B2 server. The older `qr-forever-api` folder is a historical Worker scaffold and is not used. GitHub Pages cannot execute this server. Keep Pages serving the current website until this application is deployed with HTTPS.

## Requirements

- Linux, Node.js 24 (or Docker Compose), one application instance.
- Persistent local disk for SQLite and temporary uploads; reserve at least 5 GB disk. Use 4 GB RAM for the default image profile, or the restricted 1 GB VPS profile documented below. SQLite cannot be placed on object storage or a network filesystem.
- An HTTPS reverse proxy, private Backblaze bucket and a **standard application key** restricted to that bucket. Master keys cannot authenticate to B2 S3.
- Bucket read, write, list and delete-version permissions. Object Lock and policies that block deletion conflict with expiry cleanup. `check()` positively verifies private owner-only ACL and list-version access. Credentials remain on the server.

## Initialize securely on the server

From `server/`:

```sh
npm ci
node scripts/init-admin.mjs .env
```

The interactive command hides password input, requires at least 14 characters and creates a private `.env` without overwriting an existing file. Edit that file locally with the public URL, B2 endpoint, region, bucket, key ID and application key. Do not commit or send it in chat. See `.env.example` for names. `APP_SECRET` must remain stable: changing it prevents recovery of existing encrypted album links. Back up this secret separately from the database. To reset the administrator password, generate a separate temporary configuration, copy only its password hash to the real config, delete existing sessions and restart.

For direct Node deployment set `DATA_DIR` to a writable persistent directory, `HOST=127.0.0.1`, and start with:

```sh
node --env-file=.env index.mjs
```

For Docker, from `server/`:

```sh
docker compose up -d --build
```

The container binds only host loopback port 3000. Its named `qr_data` volume survives container replacement. Do not remove this volume. Route the real domain through an HTTPS proxy such as Caddy:

```caddyfile
jbpsuport.online {
    reverse_proxy 127.0.0.1:3000
}
```

Set `TRUST_PROXY=1` only with exactly one trusted proxy and no public access to port 3000. Configure other proxies to permit slightly over 200 MiB multipart request bodies, with enough timeout for uploads. Do not enable request-body logging or authorization/cookie logging. Set DNS only after the app, TLS and live B2 tests pass.

## Operations and behavior

- `/admin.html`: real password login; eight-hour HttpOnly/SameSite Strict sessions, Secure in production. Login attempts are throttled. Every API mutation verifies the exact public Origin.
- Administrator creates events with name, location, date, GB quota, optional photograph count limit, and retention duration. Expiry is end of event date UTC plus the chosen days. Changes below reserved/used capacity are rejected. Disable closes guest access without deleting photos. Link rotation invalidates all old QR links.
- Links contain a random 256-bit capability in the fragment, which is not sent as a URL to the server. The frontend supplies it in the Authorization header. Anyone with the link can upload/view/download; only authenticated administrators delete. Keep QR links private.
- Uploads optionally accept a multipart `description` field, trimmed to at most 500 characters. Descriptions are stored as plain text in SQLite, included in guest/admin photo metadata, and must be rendered through `textContent` rather than HTML. Existing databases receive an additive, default-empty description migration. Unknown, duplicate or oversized text fields are rejected before photo quota reservation.
- Admin event listing uses `GET /api/admin/events?offset=0&limit=250` and returns `events` plus numeric `nextOffset` or `null`. Page sizes are 1–250, with no silent overall 1,000-event cutoff; clients follow pages until `null`. Refresh the list after simultaneous event creation/deletion, because offset pages are not a transactional snapshot.
- JPEG, PNG and non-animated WebP are accepted, up to 200 MiB and 80 million pixels. Other formats, including HEIC, are rejected. Original image bytes and embedded metadata remain intact. Browser thumbnails are generated at 600px without original metadata. Upload reservation counts original bytes; private transient thumbnails are not stored in B2.
- Four uploads and two thumbnail generations may execute concurrently. Excess traffic is rejected for retry, keeping temporary-disk and CPU work bounded. Quota/count reservations happen atomically before external writes, including outstanding and failed deletion records.
- Uploaded objects use unique `qr-forever/{event}/{photo}` keys. B2's exact version ID is stored and reads are authenticated. Upload is read back and SHA256 verified. Uncertain writes retain a cleanup row. No automatic ambiguous-upload retry creates unnoticed versions.
- Expired albums reject guest access immediately, but successfully stored photos remain private for a fixed 72-hour grace period after `expiresAt`. Automatic deletion becomes due at `deletionAt = expiresAt + 72 hours` and runs on the first startup/hourly cleanup sweep at or after that time. Failed deletions remain recorded, charged to capacity and retried. Disabling an album does not shorten this schedule. Explicit administrator deletion remains immediate; failed/incomplete uploads still follow their separate recovery cleanup. Cleanup touches only tracked keys; bucket-wide deletion is never used.
- Admin event responses expose `expired`, `deletionAt`, `inGracePeriod`, and `retentionStatus` (`active`, `grace`, or `deletion_due`). These describe the schedule, not proof that every B2 object has been deleted. Extending expiry during grace moves the deletion deadline and restores guest access if the event is enabled. Extending while deletion has already begun cannot recover a photo whose removal is in progress; each subsequent photo is rechecked before deletion.
- A stopped server cannot run expiry cleanup; after restart it resumes. Monitor process uptime, `/api/health` (`storageConfigured`), persistent disk usage and DB rows stuck in `deleting`. Deploy a single instance; multiple instances would break process-local concurrency and startup recovery assumptions.
- Back up SQLite using SQLite's backup facility or stop the app while copying DB/WAL. Retain protected configuration and B2 data as appropriate. A metadata database backup alone does not restore deleted B2 objects. After restoring an old DB, reconcile orphan objects before resuming writes.
- Homepage request/checkout emails still use the existing FormSubmit flow. Card/MIA selection records preference; it does not charge payment or automatically provision an event. Administrator activates agreed events manually.

## Verification

```sh
npm test
```

The current suite has 26 passing tests. The test suite uses synthetic images and in-memory storage injection; it does not contact B2. It covers authentication, CSRF, session/link persistence, link rotation, event isolation, valid/invalid upload, original and thumbnail download, forbidden guest deletion, count/byte quota, concurrent reservation, disabled-event upload cancellation, expiry cleanup, failed deletion retries and restart reconciliation. Storage contract tests check private ACL, exact-version deletion and checksum validation.

Before live launch: securely configure the standard B2 key, verify `/api/health`, log in, create a disposable event, upload a synthetic image, compare the downloaded bytes, check another event cannot see it, delete through admin, and verify expiry and QR navigation from a phone. Never call the service live until those checks pass.


## Small VPS resource profile

For a single-instance Linux VPS with 1 GB RAM, use these settings:

```dotenv
MAX_IMAGE_PIXELS=24000000
MAX_UPLOAD_CONCURRENCY=1
MAX_THUMBNAIL_CONCURRENCY=1
IMAGE_PROCESS_CONCURRENCY=1
MAX_ARCHIVE_CONCURRENCY=1
MAX_ARCHIVE_FILES=10000
NODE_OPTIONS=--max-old-space-size=192
```

The default pixel ceiling is 80 MP; this low-memory profile accepts at most 24 MP per image. Guest album metadata advertises `maxImagePixels` and `maxFileBytes`. The 200 MiB file ceiling is unchanged: originals stream through temporary disk and B2 rather than being buffered in V8. Provision disk space and swap, and monitor RSS under representative images before increasing these limits. A 192 MB V8 heap cap does not cap native libvips allocations.

Configuration accepts integer pixel ceilings from 1 to 80 million, upload concurrency 1-4 (default 4), thumbnail concurrency 1-2 (default 2), and shared image-processing concurrency 1-2 (default 2). A shared gate prevents uploads and thumbnails from decoding simultaneously above this cap and rejects excess decode work with HTTP 503 for retry. It releases immediately after decoding so a slow B2 upload does not reserve image-processing capacity. libvips uses one worker thread and a 16 MB operation cache; all error paths release their slot.

## Album ZIP downloads

The gallery can download all available photos or a selection as one ZIP. This is a native browser download: neither the frontend nor the server buffers the complete archive or all original photos in memory. The archive preserves original bytes and uses generated names (`photo-0001.jpg`, etc.); original filenames are not exposed inside it. Entries use ZIP STORE (no redundant image compression), with ZIP64 automatically available when archive size requires it.

1. An authenticated guest sends `POST /api/album/download-ticket` with same-origin JSON `{ "photoIds": null }` for the album, or `{ "photoIds": ["uuid", "uuid"] }` for 1–1,000 unique selected photos.
2. The server snapshots the selected ready photo IDs into SQLite. Unknown photos or another album's photos reject the entire request. Empty albums and empty selections return an error.
3. The response contains a relative `downloadUrl`, `expiresIn: 120`, and `photoCount`. Navigate to that URL directly; do not fetch it into a Blob. The random ticket is a short-lived download capability, so proxies and analytics must not log its full URL.
4. `GET /api/downloads/:ticket` validates the event, expiry, current guest-token hash and every snapshot item. The ticket is consumed only after validation and acquiring an archive slot. B2 originals are then fetched lazily, sequentially, with stream backpressure. Event status, token and photo availability are checked again before each source read.

Concurrency defaults to one active ZIP (`MAX_ARCHIVE_CONCURRENCY`, integer 1–2). Both ticket creation and download reject a busy server with HTTP 503; a ticket rejected because of a busy slot remains usable until its two-minute expiry. Client cancellation aborts the pending B2 request and closes the active source. Source failure ends the connection as an incomplete download, rather than returning a successful partial ZIP.

**The archive limit is separate from event capacity.** `MAX_ARCHIVE_FILES` defaults to 10,000 photos per ZIP and accepts integer values from 1–50,000. This bounds ZIP central-directory metadata on the 1 GB VPS. Raising it requires memory testing on the target host. An album above the limit gets an explicit HTTP 413 asking the guest to select smaller groups; it is never silently truncated, and its event/photo quota remains unchanged. A selection is independently limited to 1,000 photos. At most five unexpired pending tickets per event are allowed; additional requests return HTTP 429. Expired ticket snapshots are removed when new tickets are created. Guest ticket requests are also throttled to 15 per minute per client IP.

The four archive regression tests validate original bytes and CRCs, all/selected exports, cross-album rejection, one-use tickets, timeout, token rotation, disabled events, source failures, sequential fetching, concurrent-slot recovery, the 1,000-ID JSON request, and archive/pending-ticket limits. These automated tests use synthetic in-memory storage. Live ZIP verification must be recorded separately after deployment.
