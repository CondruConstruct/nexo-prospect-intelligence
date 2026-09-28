# Canonical domain activation

The timer keeps the temporary URL usable while waiting for **both** `qrforever.md` and `www.qrforever.md`. Set both A records to `162.254.38.74`; remove stale AAAA records because this deployment has no configured public IPv6 route. Waiting for www deliberately avoids redirecting visitors to an address whose TLS certificate is not ready. A CNAME from www to the apex also works.

On the existing VPS, upload these files with the application, install `Caddyfile.example` as `/etc/caddy/Caddyfile`, validate it and reload Caddy. Initially all three HTTPS names proxy the app, while `PUBLIC_URL` remains the temporary address. The new domain is not ready for form use until automatic activation completes.

```sh
install -m 644 /opt/qr-forever/current/server/deploy/qr-forever-domain.service /etc/systemd/system/
install -m 644 /opt/qr-forever/current/server/deploy/qr-forever-domain.timer /etc/systemd/system/
/usr/local/bin/caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl daemon-reload
systemctl enable --now qr-forever-domain.timer
systemctl start qr-forever-domain.service
```

The root-owned script runs with Python's standard library plus existing `curl`, Caddy and systemd; it installs nothing. Keep the script/root deployment directory unwritable by the application user. Every five minutes it checks system DNS, public Google DNS (A and AAAA), and publicly trusted HTTPS for both names by directing curl to this VPS. It changes only the existing `PUBLIC_URL` assignment, atomically, preserving other environment contents and file permissions/ownership. App/B2 health must then pass before aliases switch to canonical redirects. Failure restores protected environment/Caddy backups and restarts the previous configuration. An interrupted cutover is rolled back on the next run.

All configuration backups and state stay root-only in `/etc/qr-forever/domain-cutover`. Success removes backups and writes `complete`; subsequent checks do nothing. Logs include status only, never environment content. View status with `journalctl -u qr-forever-domain.service --no-pager` and the marker. After activation the timer can remain enabled or be disabled.

Temporary URLs and www redirect to the canonical apex using HTTP 302, keeping path and query. Standard browser fragment inheritance preserves the private `#event=...` QR token because the redirect Location does not introduce a fragment. Existing sessions are scoped to their old host; administrators sign in again on the canonical host. Newly generated QR links use the new canonical URL.

The script owns the full Caddyfile for this dedicated VPS. Do not use it without adapting the generated configuration if unrelated services are later added. Readiness is a current observation, not a guarantee against later DNS changes; the completed marker prevents repeated automatic changes.
