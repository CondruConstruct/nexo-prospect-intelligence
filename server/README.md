# QR Forever application server

This is the real administrator, private album and Backblaze B2 server. The older `qr-forever-api` folder is a historical Worker scaffold and is not used. GitHub Pages cannot execute this server. Keep Pages serving the current website until this application is deployed with HTTPS.

## Requirements

- Linux, Node.js 24 (or Docker Compose), one application instance.
- Persistent local disk for SQLite and temporary uploads; reserve at least 5 GB disk and 4 GB RAM. SQLite cannot be placed on object storage or a network filesystem.
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
- JPEG, PNG and non-animated WebP are accepted, up to 200 MiB and 80 million pixels. Other formats, including HEIC, are rejected. Original image bytes and embedded metadata remain intact. Browser thumbnails are generated at 600px without original metadata. Upload reservation counts original bytes; private transient thumbnails are not stored in B2.
- Four uploads and two thumbnail generations may execute concurrently. Excess traffic is rejected for retry, keeping temporary-disk and CPU work bounded. Quota/count reservations happen atomically before external writes, including outstanding and failed deletion records.
- Uploaded objects use unique `qr-forever/{event}/{photo}` keys. B2's exact version ID is stored and reads are authenticated. Upload is read back and SHA256 verified. Uncertain writes retain a cleanup row. No automatic ambiguous-upload retry creates unnoticed versions.
- Expired albums reject access immediately. Physical deletion runs on startup and hourly. Failed deletions stay recorded, charged to capacity and retried. Disabled albums are retained until their scheduled expiry. Cleanup touches only tracked keys; bucket-wide deletion is never used.
- A stopped server cannot run expiry cleanup; after restart it resumes. Monitor process uptime, `/api/health` (`storageConfigured`), persistent disk usage and DB rows stuck in `deleting`. Deploy a single instance; multiple instances would break process-local concurrency and startup recovery assumptions.
- Back up SQLite using SQLite's backup facility or stop the app while copying DB/WAL. Retain protected configuration and B2 data as appropriate. A metadata database backup alone does not restore deleted B2 objects. After restoring an old DB, reconcile orphan objects before resuming writes.
- Homepage request/checkout emails still use the existing FormSubmit flow. Card/MIA selection records preference; it does not charge payment or automatically provision an event. Administrator activates agreed events manually.

## Verification

```sh
npm test
```

The test suite uses synthetic images and in-memory storage injection; it does not contact B2. It covers authentication, CSRF, session/link persistence, link rotation, event isolation, valid/invalid upload, original and thumbnail download, forbidden guest deletion, count/byte quota, concurrent reservation, disabled-event upload cancellation, expiry cleanup, failed deletion retries and restart reconciliation. Storage contract tests check private ACL, exact-version deletion and checksum validation.

Before live launch: securely configure the standard B2 key, verify `/api/health`, log in, create a disposable event, upload a synthetic image, compare the downloaded bytes, check another event cannot see it, delete through admin, and verify expiry and QR navigation from a phone. Never call the service live until those checks pass.
