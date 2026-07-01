# NEXO Prospect Intelligence Website

Production static website for **NEXO by NEXOGREX S.R.L.**

Live URL: https://condruconstruct.github.io/nexo-prospect-intelligence/

## Public pages

- Home: `index.html`
- Services: `services.html`
- Prospect Intelligence: `prospect-intelligence.html`
- Process: `process.html`
- Solutions: `solutions.html`
- Data Quality: `data-quality.html`
- Pricing: `pricing.html`
- Resources: `resources.html`
- About: `about.html`
- Contact: `contact.html`
- Thank You: `thank-you.html`
- Privacy: `legal/privacy.html`
- Terms: `legal/terms.html`

## Contact flow

Forms post to FormSubmit for delivery to `Condru01@gmail.com` and include a visible mailto fallback. GitHub Pages cannot securely send email directly without a third-party form service or backend. Telegram bot tokens must not be exposed in frontend code.

## Local preview

```bash
python -m http.server 8787
```

Open: <http://127.0.0.1:8787/>

## Deployment

Push `main` to GitHub. GitHub Pages serves the root directory.

## Internal automation

Scripts under `scripts/` and files under `config/` are internal. Do not publish tokens, OAuth files, bot tokens, or chat IDs.
