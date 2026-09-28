# VPS deployment — 28 September 2026

Live application: https://qr-forever.162-254-38-74.sslip.io/

Administrator: append `/admin.html`, username `admin`. The generated password is delivered privately and is not present in this repository. Temporary hostname uses sslip.io DNS; it should be replaced by the owner's domain for ongoing use.

- Host: 162.254.38.74, AlmaLinux 9.7, approximately 1 GB RAM and 20 GB disk.
- Node 24.21.0 and Caddy 2.11.4 downloaded from their official releases, verified against published checksums.
- App runs as unprivileged `qrforever`, proxied through Caddy HTTPS. Port 3000 is loopback-only; public ports 80/443 serve redirects/HTTPS.
- Code: `/opt/qr-forever/releases/1a0d52f`, linked as `/opt/qr-forever/current`.
- Persistent SQLite and temporary images: `/var/lib/qr-forever`, protected for the service user.
- Protected environment: `/etc/qr-forever/app.env`, root-readable mode 0600. The service receives a bucket/prefix-restricted standard B2 key. Never print, copy into Git, or log the environment.
- Units: `qr-forever.service` and `caddy.service`, both enabled across reboot. Reference units are in `deploy/`.
- Added a 1 GB swap file for memory pressure. Application limits are 24 MP, one upload/thumbnail/decoder; originals remain capped at 200 MiB. These limits are advertised in the guest interface.
- Bucket `Nuntitest1` is private. Every event has a unique `qr-forever/{event-id}/` prefix; database authorization enforces event isolation. No bucket credentials reach guests.

One clearly labeled synthetic sample album/photo is retained for owner review. A second isolation test album is disabled and its test image was deleted. Retention cleanup will remove the sample after its scheduled expiry.

## Domain cutover

`jbpsuport.online` and `www.jbpsuport.online` still point to GitHub Pages at deployment time. Change their A records to `162.254.38.74`, preserve unrelated mail records, and remove only conflicting website records. Once DNS is verified, add the canonical domain to Caddy, obtain HTTPS, change `PUBLIC_URL` in the protected environment, restart the app and verify login/upload again. Keep the temporary hostname redirecting to the canonical domain so previously distributed test links continue to work.

## Operations

Check `systemctl status qr-forever caddy`, HTTPS `/api/health`, disk usage and cleanup failures. Keep code and protected configuration separate from database backups. Use SQLite's backup API or stop the app before copying a database. Do not copy a live database without its WAL. Do not delete the data directory or rotate `APP_SECRET` during normal upgrades.

Root SSH initially succeeded, subsequent connections briefly closed before authentication, then access recovered. No SSH policy or root password was changed. The hosting-panel login was not established. Rotate shared infrastructure credentials through the owner's normal recovery workflow after preserving working access.
