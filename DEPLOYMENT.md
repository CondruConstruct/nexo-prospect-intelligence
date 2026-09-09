# NEXOGREX website deployment

## Source and publishing

- Repository: https://github.com/CondruConstruct/nexo-prospect-intelligence
- Public site source: `docs/` (Romanian and English static pages).
- Selected custom domain: `jbpsuport.online`.
- Hosting: GitHub Pages, using the configured publishing branch and `/docs` directory. Confirm the current Pages configuration before changing it.
- The original root-level website is retained as legacy source. Update `docs/` for this version; do not accidentally publish the root directory.
- No build service or paid platform is required. Preserve relative asset links so local previews and Pages deployments work.

## Service boundaries

NEXOGREX SRL (IDNO 1025600002590) offers buyer/distributor prospect research and supplier sourcing. The fixed offer applies only to buyer/distributor research: five researched examples free, then twenty additional researched companies for EUR 150 as a one-time purchase, without subscription. Supplier sourcing and other research scopes receive a custom quote.

Research records explain fit, cite dated public sources, include relevant public business contacts where available, and state unknowns. They do not establish confirmed buying interest or guarantee replies, meetings, transactions, supplier performance, or sales. The research offer does not include outreach.

Use `condru01@gmail.com` for public business enquiries. Do not publish personal phone numbers, a home address, raw pilot research, invented clients, testimonials, or commercial results.

## Enquiry form

The implementation uses the free FormSubmit service to forward enquiries to `condru01@gmail.com`. A provider endpoint alone is not proof of working delivery: recipient activation and a live submission must be confirmed. Keep the email link available as a fallback. Never describe email delivery as verified until the receiving inbox confirms the test.

The form notice must accurately disclose submission to the third-party service. Avoid the former statement that the website has no forms after enabling the form. Do not put provider secrets or mailbox credentials in this public repository.

## Design provenance

The green and cream palette, typography-led composition, spacing, service sections, and research-record illustration form an original implementation for NEXOGREX. The record illustration describes the deliverable structure and is explicitly illustrative; it does not display a real prospect.

Reference sites reviewed for service segmentation and contact paths:

- https://www.b2binternational.com/
- https://marktintel.com/

These references informed high-level organisation. Their assets, text, customer claims, and testimonials were not copied.

## Release checks

Release verification completed on 10 September 2026 (Europe/Chisinau). Maintenance checklist:

1. GitHub Pages serves `docs/` and the expected commit.
2. Domain DNS resolves to the hosting configuration; `CNAME`, canonical, Open Graph and language-alternate URLs use the selected public domain.
3. HTTPS loads both language pages and their CSS/favicon without mixed content or missing assets.
4. Desktop and mobile layouts have readable text, usable navigation and form controls, and no horizontal overflow.
5. All internal links, language switching, email links and form validation behave correctly.
6. FormSubmit recipient activation is complete and a clearly identified test enquiry arrives in the designated inbox.
7. Supplier sourcing consistently uses custom quotes; EUR 150 never appears to buy a supplier package.

For maintenance, edit the two language pages together, preview them, repeat the checks affected by the change, and push the updated source. Do not purchase domains, hosting, or service upgrades as part of this free hosting setup.

## Verified release outcome — 2026-09-10

- Live: https://jbpsuport.online/ (Romanian), https://jbpsuport.online/en.html (English). GitHub Pages serves main /docs with HTTPS enforced. Certificate approved for apex and www; www redirects to apex. Certificate-validated HTTP 200 checks passed for both pages, CSS, JavaScript, favicon, robots and sitemap.
- Desktop 1440 px and mobile 390 px layouts visually inspected. Mobile document width equals viewport width; required-field validation and internal anchors checked. Browser console has no site errors. JavaScript syntax check passed; no build step required.
- FormSubmit recipient activation completed. A uniquely labelled live test arrived in the confirmed recipient mailbox with required fields and correct Reply-To. Gmail initially classified it as Spam; only the two verified test messages were moved to Inbox. Future inbox placement is not guaranteed.
- No Gmail filter-creation tool was available. Fallback mailbox query: `in:anywhere from:submissions@formsubmit.co to:condru01@gmail.com subject:"NEXOGREX website research enquiry"`. Exclude setup-test markers from real demand counts.
- Previous domain site preserved in CondruConstruct/Siteuri-Abonament at tag `archive-before-nexogrex-20260910` (commit 9a7abd253dbc69474365fad8b65b48c9dfe79db5). Only its public/CNAME was removed to release the domain; no unrelated domain or DNS setting changed.
- Old NEXO root source is preserved. This release contains only original site assets and supplied approved company identity; no pilot datasets were published.
- FormSubmit's official privacy PDF is accessible through the browser/web reader, although automated Python requests receive HTTP 403.
