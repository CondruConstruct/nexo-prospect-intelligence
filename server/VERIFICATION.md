# Verification — 28 September 2026

## Real Backblaze account

The existing private bucket `Nuntitest1` was tested. No customer photographs were used.

- Native API authentication, synthetic image upload and authenticated download succeeded; downloaded bytes matched. Anonymous download returned 401. Exact test version deletion succeeded and subsequent download returned 404.
- S3 adapter smoke passed private ACL verification, upload, SHA-256 readback, download, exact-version deletion and post-deletion unavailability.
- Complete Node application smoke passed admin login, event creation, image upload, gallery listing, exact original download, JPEG thumbnail, photo-count rejection, wrong-token rejection, admin deletion and post-deletion 404.
- S3 tests used temporary keys restricted to this bucket and the `qr-forever/` prefix. Keys were revoked and test files removed afterward. No production credential was stored in source or documentation.

## Automated and browser verification

`npm test`: 14 passing tests cover storage permissions/integrity, authentication, CSRF, session persistence/logout, link encryption/rotation, album isolation, concurrent reservations, quotas, invalid and oversized images, multipart cleanup, disable/expiry, interrupted uploads and cleanup retries. Rotation during upload and retention extension during deletion have explicit regression coverage.

Real browser verification against a local server with injected test storage passed login, creation, QR generation, photo upload, thumbnail and original preview, download, limit rejection, administrator deletion, link rotation and logout. Admin layout checked at widths 320, 390, 768 and 1440; mobile guest gallery visually reviewed. Switching album fragments reloads authorization correctly.

Sharp was upgraded to 0.35.5; dependency audit reported zero known vulnerabilities at verification time.

## Remaining deployment checks

This proves account compatibility and application behavior, not production deployment. The Linux host is not yet selected. Before switching DNS, configure HTTPS, persistent storage, a production scoped B2 key and administrator password; rerun the smoke test on that host and scan an event QR on a phone. Docker image execution has not been tested on the forthcoming host.

The exposed master key should be replaced before launch. The application uses a standard scoped key, never the master key. No automatic payments are implemented; the existing email request/payment-preference flow remains.
