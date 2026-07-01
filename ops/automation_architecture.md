# NEXO Automation Architecture

## Current safe status

This project is prepared for automation but should run in draft/approval mode until credentials and compliance setup are complete.

## Components

1. Landing page
   - Static site in this folder.
   - Current form uses temporary `mailto:INSERT_BUSINESS_EMAIL@example.com`.
   - Replace with a real endpoint before launch.

2. Client prospect tracker
   - `ops/nexo_client_prospect_tracker.csv`
   - Can later be moved to Google Sheets.

3. Outreach playbook
   - `ops/outreach_playbook.md`
   - Draft templates only; do not bulk-send without final approval.

4. Payment handoff
   - Use invoice/bank transfer through NEXOGREX S.R.L.
   - Work starts after scope confirmation and payment.

5. Reply monitoring
   - Requires actual email inbox access: Gmail OAuth/IMAP/SMTP or provider API.
   - Default should be draft-only replies, with Telegram alert to owner.

6. Telegram alerts
   - Requires bot token + chat ID or existing Hermes delivery target.
   - Alerts should not include excessive personal data.

7. Cron jobs
   - Only NEXO-owned cron jobs should be created/removed automatically.
   - Unknown old crons must be listed before deletion.

## Required credentials before full automation

- Business email address for NEXO.
- SMTP or Gmail API/IMAP credentials for sending and reading replies.
- Approved physical mailing address for commercial email footer.
- Approved sender name.
- Suppression list storage.
- Telegram bot token/chat ID or approved Hermes delivery target.
- GitHub authentication or repo URL for deployment.
- Optional Google Sheets API/service account if using Sheets instead of CSV.

## Safe automation flow

1. Collect/import 100 companies per niche.
2. QA and score them.
3. Present recipient batch to user for approval.
4. Test-send template to owner.
5. After approval, send low-volume campaign with opt-out line.
6. Monitor inbox replies.
7. Alert user on Telegram for positive/uncertain replies.
8. Draft response; do not auto-send until enabled.
9. If client requests quote, create scope + invoice instructions.
10. After payment confirmation, start prospect research delivery.

## Do not automate without explicit approval

- Public launch to final domain.
- Cold email sending.
- Auto-replies to prospects.
- Deleting non-NEXO cron jobs.
- Access to client accounts.
- Sending invoices with final payment instructions.
- Any claim involving compliance guarantee, testimonials, revenue, or meetings.
