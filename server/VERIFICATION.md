# Verification — 28 September 2026

## Latest deployed gallery, admin and retention verification

Production code `835ffcf` on the owner VPS passed real browser admin create/QR/logout, guest upload with description, original preview and ZIP download, plus admin overview, expiry edit, grace-period storage preservation with denied guest access, expiry extension, QR rotation, explicit photo deletion and disable. A QR decoder recovered the generated live URL; the ZIP original matched the uploaded fixture SHA-256. Only the newly created synthetic photo was deleted; existing owner photos were preserved.

Local browser verified 12 mixed-aspect photos, select two/select displayed/clear, all-photo and selected-photo ZIP contents/CRC/SHA-256, literal text caption safety and hidden filenames. Public homepage/request/plan/payment-preference/thank-you flows, failure retries, editing and both payment preferences passed with intercepted provider responses: no real email sent in this test and inbox delivery remains a separate check. Payments remain preferences only.

Phone/tablet/desktop widths 320/390/768/1440 were checked. Fixed admin overflow and fractional quota input validation; reviewed screenshots show no overlapping text in tested layouts. The 26-test backend suite passes, including deterministic 72-hour expiry deletion, migration, pagination, event isolation and archive cancellation/failure.

Domain automation is installed and enabled, checking every five minutes. DNS for qrforever.md/apex and www was still pending at verification; actual new-domain HTTPS activation is not yet claimed. Source and existing live site remain on the temporary HTTPS hostname until readiness checks pass.

## Real Backblaze account

The existing private bucket `Nuntitest1` was tested. No customer photographs were used.

- Native API authentication, synthetic image upload and authenticated download succeeded; downloaded bytes matched. Anonymous download returned 401. Exact test version deletion succeeded and subsequent download returned 404.
- S3 adapter smoke passed private ACL verification, upload, SHA-256 readback, download, exact-version deletion and post-deletion unavailability.
- Complete Node application smoke passed admin login, event creation, image upload, gallery listing, exact original download, JPEG thumbnail, photo-count rejection, wrong-token rejection, admin deletion and post-deletion 404.
- S3 tests used temporary keys restricted to this bucket and the `qr-forever/` prefix. Keys were revoked and test files removed afterward. No production credential was stored in source or documentation.

## Automated and browser verification

Initial backend milestone: `npm test` had 14 passing tests covering storage permissions/integrity, authentication, CSRF, session persistence/logout, link encryption/rotation, album isolation, concurrent reservations, quotas, invalid and oversized images, multipart cleanup, disable/expiry, interrupted uploads and cleanup retries. Rotation during upload and retention extension during deletion have explicit regression coverage.

Real browser verification against a local server with injected test storage passed login, creation, QR generation, photo upload, thumbnail and original preview, download, limit rejection, administrator deletion, link rotation and logout. Admin layout checked at widths 320, 390, 768 and 1440; mobile guest gallery visually reviewed. Switching album fragments reloads authorization correctly.

Sharp was upgraded to 0.35.5; dependency audit reported zero known vulnerabilities at verification time.

## Deployment checks recorded before VPS access (historical)

This proves account compatibility and application behavior, not production deployment. The Linux host is not yet selected. Before switching DNS, configure HTTPS, persistent storage, a production scoped B2 key and administrator password; rerun the smoke test on that host and scan an event QR on a phone. Docker image execution has not been tested on the forthcoming host.

The exposed master key should be replaced before launch. The application uses a standard scoped key, never the master key. No automatic payments are implemented; the existing email request/payment-preference flow remains.

## VPS production verification

Deployed September28 to AlmaLinux9.7 at162.254.38.74, Node24.21.0 and Caddy2.11.4 with valid public HTTPS on the temporary sslip.io hostname.17 automated tests now pass. Public real-browser checks verified admin username/password login, QR creation, logged-out guest upload, thumbnail, full-resolution preview and original download. SHA256 download match and independent QR decoding passed. Separate-event content/thumbnail access was404; guest delete denied; count quota409; authenticated deletion confirmed; disabled album404. Backblaze listing verified only the retained sample image remains, with no hidden delete markers. App restart preserved its DB/link/photo; service active with no automatic restarts. Observed idle application memory about34MiB; this is not a capacity benchmark. Production image ceiling24MP, one upload/thumbnail/decoder at a time,200MiB file ceiling. Linux deployment is direct systemd, not Docker. Domain DNS cutover and a physical phone scan are still separate checks.

## Album ZIP backend update — 28 September 2026

At the archive milestone, the local suite had **21 passing tests** (17 existing tests plus four archive regression tests). The final four archive tests also passed a focused rerun after the native-download error response was changed to Romanian plain text. `yazl` 3.3.1 was added for streaming ZIP creation; npm reported zero known vulnerabilities at installation.

Verified with synthetic images and injected storage:

- All-photo and selected-photo ZIPs contain complete central directories, matching CRCs and exact original bytes; generated archive filenames hide original filenames.
- Cross-album selections, consumed/expired tickets, rotated guest tokens and disabled events are rejected.
- Only one B2 source is opened at a time. Busy POST/GET requests return 503, and a pending ticket rejected for capacity can still be used later.
- A failed source terminates the incomplete transfer and releases the archive slot; the next export succeeds.
- A 1,000-UUID JSON selection reaches validation rather than failing the request-body size limit.
- An album larger than `MAX_ARCHIVE_FILES` is rejected explicitly, without truncation; smaller selections remain available. Five outstanding tickets per event are allowed and expired tickets no longer block new requests.

Default deployment settings are `MAX_ARCHIVE_CONCURRENCY=1` and `MAX_ARCHIVE_FILES=10000`. The latter caps one archive, not the number of photos an event may store. Photo bodies stream without whole-archive buffering; central-directory metadata is proportional to the bounded number of entries. ZIP64 is supplied by the library for large byte totals. Interrupted or revoked downloads may already have delivered earlier bytes; checks prevent opening subsequent sources and do not revoke bytes already downloaded.

These results establish local backend behavior. They do not themselves prove that the redesigned gallery or ZIP endpoint has been deployed or passed a real Backblaze/browser ZIP test; record that evidence in the production rollout section after it is completed.

## Three-day post-expiry retention — 28 September 2026

The local automated suite now has **23 passing tests**. Guest access still closes exactly at event expiry. Ready photo objects survive expiry, restart and the instant immediately before `expiresAt + 72 hours`; a cleanup invocation at that boundary deletes them. Production automatic deletion occurs during the next startup/hourly sweep, and storage failures are retried rather than reported as completed.

The admin API now returns `deletionAt`, `expired`, `inGracePeriod` and `retentionStatus` (`active`, `grace`, `deletion_due`). Regression tests verify these fields, extending expiry during grace (including protection at the former deletion deadline), restored guest access after extension, and immediate explicit administrator deletion during grace. The existing concurrent-retention-extension test now starts after the grace deadline and still proves that remaining photos are protected when an expiry extension occurs during cleanup. No test or UI status can restore bytes already deleted or a deletion already in progress.

This is backend/local test evidence. The main deployment workflow must separately verify the updated admin UI and service rollout; no production time jump or forced deletion of customer photos was performed for these tests.

## Optional descriptions and admin event pagination — 28 September 2026

The complete local suite now has **26 passing tests**. New coverage verifies plain-text descriptions with literal HTML-like content survive upload, guest/admin metadata reads and restart; 501-character input returns 400 without consuming photo quota or leaving temporary files. An existing database with no description column is migrated without losing its photo rows, and old photos receive an empty description. Frontend safe rendering requires separate browser verification.

Admin event pagination is tested across multiple pages with unique IDs, numeric `nextOffset` and a final `null`, plus rejection of invalid offsets/page sizes. The API no longer silently stops at 1,000 events. Offset paging is not a snapshot during concurrent additions/removals; refreshing reconciles such changes.
