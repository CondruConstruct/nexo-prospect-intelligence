# NEXO — Local Prospect Intelligence Sprint

Static landing page and operating assets for **NEXO**, a service by **NEXOGREX S.R.L.**

## Files

- `index.html` — landing page
- `assets/styles.css` — design system, responsive layout, animations
- `assets/app.js` — scroll reveal behavior
- `legal/privacy.html` — draft privacy page (requires legal review)
- `legal/terms.html` — draft terms page (requires legal review)
- `ops/outreach_playbook.md` — outreach plan and templates
- `ops/nexo_client_prospect_tracker.csv` — CSV/Sheets-compatible tracker
- `ops/automation_architecture.md` — automation architecture and guardrails

## Important launch TODOs

1. Replace `INSERT_BUSINESS_EMAIL@example.com` in `index.html`, `legal/privacy.html`, and `legal/terms.html`.
2. Review privacy/terms with a qualified professional before public launch.
3. Configure real form endpoint or CRM/Google Sheets capture.
4. Confirm GitHub repository and Pages deployment credentials.
5. Approve exact outreach list and email templates before sending any external messages.
6. Add real testimonials only after real customers approve them; do not fabricate social proof.
7. Start the Telegram bot at https://t.me/AI2004151BOT and send `/start`, then run `python scripts/nexo_telegram.py discover` to save the alert chat.
8. Gmail OAuth is stored locally at the Hermes token path after authorization; do not commit tokens or `config/*.env` files.

## Automation

- `scripts/nexo_telegram.py` verifies the Telegram bot, discovers the chat ID, and sends alerts.
- `scripts/google_oauth_setup.py` refreshes/creates Gmail OAuth credentials.
- `scripts/nexo_gmail_reply_watchdog.py` monitors NEXO-related Gmail replies. It is configured as a Hermes cron job through a wrapper in the Hermes scripts folder.
- The watchdog is quiet when nothing is new. If a positive NEXO-related reply appears, it sends a safe automatic first response and alerts Telegram when the NEXO chat ID is configured.

## Local preview

```bash
python -m http.server 8787
```

Open: http://127.0.0.1:8787/

## Deployment

This folder can be pushed to a GitHub repository and served with GitHub Pages from the repository root.

GitHub CLI is currently not required for the static files, but repo creation/push requires GitHub authentication.
