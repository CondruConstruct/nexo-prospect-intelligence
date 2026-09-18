# QR Forever

Public website: https://jbpsuport.online/

The original Drive template's layout, typography, ring motif and palette are retained. The previous NEXOGREX publication remains available in Git history at commit `d644d90d0bc92451a19f774cd2816834ff94fb8f`. Only the GitHub Pages `/docs` publication is replaced; unrelated research and old source remain untouched.

## Available now

- Romanian event request form addressed to `danscutari04@gmail.com` through FormSubmit, with required contact/event fields and consent. First-use recipient activation may be required. A successful provider response does not prove inbox delivery.
- `/admin.html`: clearly labeled preparation mode. Configure event name, date, GB and retention days, generate/download/print a **demonstration** QR, open its matching preview. No details are persisted. This page contains no administrative secret and gives no access to real records.
- `/album.html`: private-link-shaped guest screen, gallery/upload tabs, missing/expired/unavailable states. No public album index, no file inputs, no uploads, no stored photos and no guest deletion.
- `qr-forever-api/`: tested, undeployed metadata API. Private 256-bit tokens, admin authorization, quotas, expiration and disable settings; photo endpoints fail closed. The frontend has the matching future admin login, create/edit/list/pagination/disable interface.

## Activation later

1. Confirm FormSubmit activation in the recipient mailbox and verify a real request arrives, including Spam. The request button is not automatic album activation.
2. Deploy metadata API with D1 and a server-only admin secret. Configure exact allowed frontend origins, then set the API origin plus `/api` in `docs/js/config.js`. No secret goes in frontend code. Static GitHub Pages does not run the Worker.
3. Build/connect the photo storage adapter described in the API README. Quota reservation, validation, cross-event access, download authorization and scheduled deletion must be implemented and verified before enabling uploads. Storage is intentionally absent in this version.
4. Test a real two-device guest upload/view/download flow and expiry before giving guests operational QR codes. Demonstration links are editable previews, not authenticated records.

Retention uses the event day's end in UTC plus the selected number of days. No storage purchase, cloud resource creation, photo saving or automatic deletion service was performed.

QR generator: qrcode-generator 2.0.4 (MIT), vendored with copyright header. No external QR service receives event links.
