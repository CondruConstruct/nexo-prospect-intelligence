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

## Local preview

```bash
python -m http.server 8787
```

Open: http://127.0.0.1:8787/

## Deployment

This folder can be pushed to a GitHub repository and served with GitHub Pages from the repository root.

GitHub CLI is currently not required for the static files, but repo creation/push requires GitHub authentication.
