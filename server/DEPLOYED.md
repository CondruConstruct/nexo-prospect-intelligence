# VPS deployment — 28 September 2026

Live application: https://qrforever.md/

Administrator: append `/admin.html`, username `admin`. The generated password is delivered privately and is not present in this repository. The old temporary sslip.io hostname redirects to the canonical domain, preserving existing album links.

- Host: 162.254.38.74, AlmaLinux 9.7, approximately 1 GB RAM and 20 GB disk.
- Node 24.21.0 and Caddy 2.11.4 downloaded from their official releases, verified against published checksums.
- App runs as unprivileged `qrforever`, proxied through Caddy HTTPS. Port 3000 is loopback-only; public ports 80/443 serve redirects/HTTPS.
- Code: `/opt/qr-forever/releases/835ffcf`, linked as `/opt/qr-forever/current`.
- Persistent SQLite and temporary images: `/var/lib/qr-forever`, protected for the service user.
- Protected environment: `/etc/qr-forever/app.env`, root-readable mode 0600. The service receives a bucket/prefix-restricted standard B2 key. Never print, copy into Git, or log the environment.
- Units: `qr-forever.service` and `caddy.service`, both enabled across reboot. Reference units are in `deploy/`.
- Added a 1 GB swap file for memory pressure. Application limits are 24 MP, one upload/thumbnail/decoder; originals remain capped at 200 MiB. These limits are advertised in the guest interface.
- Bucket `Nuntitest1` is private. Every event has a unique `qr-forever/{event-id}/` prefix; database authorization enforces event isolation. No bucket credentials reach guests.

One clearly labeled synthetic sample album/photo is retained for owner review. Isolation test albums are disabled and their test images removed. Guest access ends at expiry; hourly/startup cleanup deletes photos only after an additional 72 hours. Explicit administrator deletion remains immediate.

## Domain cutover

The owner has selected the new domain `qrforever.md`. Set apex and `www` A records to `162.254.38.74`, with no conflicting website A/AAAA records. Namecheap FreeDNS requires enrolling this externally registered domain before delegating to its `freedns*.registrar-servers.com` nameservers. The older `jbpsuport.online` site is separate and is not the new canonical target.

Caddy is prepared for apex/www and the existing temporary host. The enabled `qr-forever-domain.timer` checks every five minutes for correct public/server DNS and trusted HTTPS on both new names. It then changes only `PUBLIC_URL`, checks app/storage health and redirects temporary/www to the canonical host. Failure restores the previous configuration; existing QR fragments survive redirects. See `deploy/DOMAIN-ACTIVATION.md`. DNS remains pending at this release's deployment check; do not claim canonical activation merely because the timer is enabled.

Update `eb3cf7f` adds all/selected ZIP downloads, hidden guest filenames, proportional photo rows, optional descriptions under photos, and a paginated admin overview with photo counts, storage and both retention dates. A consistent SQLite backup was taken before deployment. The first attempt exceeded its readiness window and rolled back; isolated startup then passed, and the retry became healthy in approximately one second.

Follow-up `835ffcf` fixes fractional quota rounding in the admin edit form. The live browser exposed that byte-to-GB conversion could violate the input's 0.001 step; the corrected form was then used successfully to expire and extend a real synthetic test album.

## Operations

Check `systemctl status qr-forever caddy`, HTTPS `/api/health`, disk usage and cleanup failures. Keep code and protected configuration separate from database backups. Use SQLite's backup API or stop the app before copying a database. Do not copy a live database without its WAL. Do not delete the data directory or rotate `APP_SECRET` during normal upgrades.

Root SSH initially succeeded, subsequent connections briefly closed before authentication, then access recovered. No SSH policy or root password was changed. The hosting-panel login was not established. Rotate shared infrastructure credentials through the owner's normal recovery workflow after preserving working access.

## Canonical activation confirmed

At19:05UTC on28September2026, the installed timer activated https://qrforever.md/. Both alfa.dns.md and beta.dns.md return162.254.38.74; publicCloudflare/GoogleDNS agree. ApexHTTPS200 and health(storageConfiguredtrue), www/temporary redirects confirmed fromVPS. Canonicalbrowser adminlogin, newQRdomain, oldQRfragmentredirect, albumthumbnail and selectedZIP allpassed. BrowserQA used isolatedhostresolution because the workstation network resolver still cachedNXDOMAIN; HTTPSverification was not bypassed. LocalDNSflush didnot clear upstreamnegativecache. No DNSaccount or globalnetworksetting changes were made.
