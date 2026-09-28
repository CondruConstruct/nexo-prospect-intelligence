# QR Forever

## September 28 replacement — current public flow

The new supplied violet/peach design replaces the September 18 theme and the old two-page plan selection. Plans now follow the user's files: Esențial EUR29 / 100 photos / 7 days / 10 optional stickers; Amintiri EUR69 / 500 photos / 15 days / 20 stickers; Poveste EUR99 / unlimited photos / 60 days / 40 stickers. These are request offers; photo features remain disconnected. Table stands cost EUR8 each, quantity 0–99. Delivery is quoted separately. The supplied 200MB per-file limit is a proposed future capability, not active storage behavior.

Flow: choose plan and materials on homepage -> send complete request through FormSubmit -> `/plata.html` reads same-tab session order -> choose Card/MIA preference -> send confirmation email -> thank-you. Email recipient remains danscutari04@gmail.com. Both emails include full order details, same request ID, and explicit UNPAID status. Failed provider responses do not redirect or clear data. Edit restores the order. Browser session data expires after 24 hours and is removed on completion; no personal details are placed in query strings.

**No payment processor or merchant MIA link was supplied.** The provided card fields and placeholder payment alerts were removed. This is an administrator-arranged payment preference, not a checkout that charges money. Real payments require merchant onboarding/provider-hosted checkout plus a server-verified webhook and authoritative server pricing. Do not add raw card/CVC fields or trust URL/browser totals for charging. The user was asked for provider details.

The old `/planuri.html` redirects to homepage pricing. Admin/album previews remain available with matching new theme. The prepared API still uses GB quotas and is undeployed; it does not enforce the new photo-count plans. Upgrade its schema and implement storage, enforcement, lifecycle and payments before real activation.

The sections below describe the original September 18 baseline and are historical where superseded by this update.

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
