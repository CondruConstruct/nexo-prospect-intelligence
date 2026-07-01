from __future__ import annotations

from pathlib import Path
from html import escape
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://condruconstruct.github.io/nexo-prospect-intelligence/"
CONTACT_EMAIL = "Condru01@gmail.com"
FORM_ACTION = f"https://formsubmit.co/{CONTACT_EMAIL}"
NEXT_URL = BASE_URL + "thank-you.html"

NAV = [
    ("Services", "services.html"),
    ("Prospect Intelligence", "prospect-intelligence.html"),
    ("Process", "process.html"),
    ("Solutions", "solutions.html"),
    ("Data Quality", "data-quality.html"),
    ("Pricing", "pricing.html"),
    ("Resources", "resources.html"),
    ("About", "about.html"),
]

PAGES = {
    "index.html": {
        "title": "NEXO — Human-Verified Prospect Intelligence for U.S. Agencies",
        "description": "NEXO helps U.S. agencies build cleaner, human-reviewed local prospect lists using public-source research, opportunity signals, and structured QA.",
        "nav": "Home",
        "hero_kicker": "LOCAL PROSPECT INTELLIGENCE FOR U.S. AGENCIES",
        "hero_title": "Cleaner local prospect lists. Stronger agency outreach.",
        "hero_text": "NEXO turns public business information into structured, human-reviewed prospect intelligence for local SEO, web design, PPC, reputation, GoHighLevel, and home-service marketing agencies.",
        "primary_cta": "Request a Prospect Sprint",
        "primary_href": "contact.html",
        "secondary_cta": "Explore the service",
        "secondary_href": "services.html",
        "body": "home",
    },
    "services.html": {
        "title": "Prospect Research Services for Local Marketing Agencies | NEXO",
        "description": "Explore NEXO prospect research services for local SEO, web design, PPC, reputation, GBP, and GoHighLevel agencies targeting U.S. SMBs.",
        "nav": "Services",
        "hero_kicker": "SERVICES",
        "hero_title": "Research-ready prospect lists built for local agency outreach.",
        "hero_text": "We collect, review, and organize public business signals so your team can focus on relevant conversations instead of manual list building.",
        "primary_cta": "Start a Sprint",
        "primary_href": "contact.html",
        "secondary_cta": "View the process",
        "secondary_href": "process.html",
        "body": "services",
    },
    "prospect-intelligence.html": {
        "title": "Local Prospect Intelligence Sprint for Agency Outreach | NEXO",
        "description": "Get a structured local prospect intelligence sprint with public-source research, visible opportunity signals, segmentation, and human QA.",
        "nav": "Prospect Intelligence",
        "hero_kicker": "PROSPECT INTELLIGENCE SPRINT",
        "hero_title": "See the local businesses worth a closer look.",
        "hero_text": "A NEXO sprint highlights public signals such as website presence, local visibility, review activity, category fit, and contactability — then organizes them into a practical dataset.",
        "primary_cta": "Request intelligence",
        "primary_href": "contact.html",
        "secondary_cta": "Review standards",
        "secondary_href": "data-quality.html",
        "body": "prospect",
    },
    "process.html": {
        "title": "How the NEXO Prospect Research Process Works",
        "description": "See how NEXO defines campaign criteria, researches public sources, verifies local business records, scores fit, and delivers CRM-ready datasets.",
        "nav": "Process",
        "hero_kicker": "PROCESS",
        "hero_title": "A clear sprint process from targeting to delivery.",
        "hero_text": "You define the market, category, and agency fit. We research public sources, review the data, and deliver a structured prospect file.",
        "primary_cta": "Plan a sprint",
        "primary_href": "contact.html",
        "secondary_cta": "View pricing",
        "secondary_href": "pricing.html",
        "body": "process",
    },
    "solutions.html": {
        "title": "Prospect List Solutions for SEO, Web Design and PPC Agencies | NEXO",
        "description": "NEXO supports agencies running outbound, audit campaigns, niche tests, market validation, and local SMB targeting with cleaner prospect lists.",
        "nav": "Solutions",
        "hero_kicker": "SOLUTIONS",
        "hero_title": "Built for agencies that sell into local markets.",
        "hero_text": "NEXO supports teams that need practical prospect research for local SEO, web design, PPC, reputation, GoHighLevel, and home-service marketing campaigns.",
        "primary_cta": "Find your use case",
        "primary_href": "contact.html",
        "secondary_cta": "See data quality",
        "secondary_href": "data-quality.html",
        "body": "solutions",
    },
    "data-quality.html": {
        "title": "Human-Reviewed Prospect Data Quality and Verification | NEXO",
        "description": "Learn how NEXO improves prospect list quality through duplicate checks, source review, public data validation, segmentation, and human QA.",
        "nav": "Data Quality",
        "hero_kicker": "DATA QUALITY",
        "hero_title": "Public-source data, structured with human review.",
        "hero_text": "Every sprint is designed to reduce noise through defined criteria, source checks, formatting consistency, and manual review before delivery.",
        "primary_cta": "Review standards",
        "primary_href": "contact.html",
        "secondary_cta": "See the process",
        "secondary_href": "process.html",
        "body": "quality",
    },
    "pricing.html": {
        "title": "Prospect Intelligence Sprint Pricing | NEXO",
        "description": "View NEXO pricing for focused prospect intelligence sprints designed for U.S. agencies that need cleaner, research-backed outreach lists.",
        "nav": "Pricing",
        "hero_kicker": "PRICING",
        "hero_title": "Simple sprint-based pricing for focused prospect research.",
        "hero_text": "Choose a focused research sprint, multi-market build, or custom market intelligence package. Each engagement is scoped before work begins.",
        "primary_cta": "Request pricing",
        "primary_href": "contact.html",
        "secondary_cta": "Compare packages",
        "secondary_href": "#packages",
        "body": "pricing",
    },
    "resources.html": {
        "title": "Prospect Research Resources for Agency Outreach | NEXO",
        "description": "Read practical resources on local prospect research, outreach list quality, opportunity signals, segmentation, and agency campaign preparation.",
        "nav": "Resources",
        "hero_kicker": "RESOURCES",
        "hero_title": "Guides and notes on local prospect research.",
        "hero_text": "Explore practical resources for building cleaner local prospect lists, reviewing public business signals, and planning agency outreach.",
        "primary_cta": "Browse resources",
        "primary_href": "#resources",
        "secondary_cta": "Request a sprint",
        "secondary_href": "contact.html",
        "body": "resources",
    },
    "about.html": {
        "title": "About NEXO by NEXOGREX S.R.L.",
        "description": "Learn about NEXO, a prospect intelligence service by NEXOGREX S.R.L. helping agencies build cleaner local SMB outreach datasets.",
        "nav": "About",
        "hero_kicker": "ABOUT NEXO",
        "hero_title": "Focused prospect research for agencies serving local businesses.",
        "hero_text": "NEXOGREX S.R.L. operates NEXO to help agencies turn public business information into organized, review-ready prospect intelligence.",
        "primary_cta": "Work with NEXO",
        "primary_href": "contact.html",
        "secondary_cta": "View services",
        "secondary_href": "services.html",
        "body": "about",
    },
    "contact.html": {
        "title": "Contact NEXO for Prospect Intelligence Services",
        "description": "Contact NEXO to discuss a local prospect intelligence sprint for your agency’s outreach, audit, market test, or SMB targeting campaign.",
        "nav": "Contact",
        "hero_kicker": "CONTACT",
        "hero_title": "Tell us what market you want to research.",
        "hero_text": "Share your target location, business category, and agency use case. We’ll review the scope and respond with next steps.",
        "primary_cta": "Request sprint scope",
        "primary_href": "#contact-form",
        "secondary_cta": f"Email {CONTACT_EMAIL}",
        "secondary_href": f"mailto:{CONTACT_EMAIL}",
        "body": "contact",
    },
    "thank-you.html": {
        "title": "Thank You — NEXO Inquiry Received",
        "description": "Thank you for contacting NEXO. Your inquiry has been submitted and the team will review your prospect intelligence request.",
        "nav": "Contact",
        "hero_kicker": "THANK YOU",
        "hero_title": "Your NEXO inquiry has been sent.",
        "hero_text": "We will review your target market, niche, and research criteria and respond with next steps by email.",
        "primary_cta": "Back to home",
        "primary_href": "index.html",
        "secondary_cta": "Explore services",
        "secondary_href": "services.html",
        "body": "thanks",
    },
    "legal/privacy.html": {
        "title": "Privacy Policy | NEXO",
        "description": "Privacy information for NEXO by NEXOGREX S.R.L., including website inquiry handling and contact details.",
        "nav": "Privacy",
        "hero_kicker": "PRIVACY",
        "hero_title": "Privacy Policy",
        "hero_text": "How NEXO handles website inquiries, contact details, and business communications.",
        "primary_cta": "Contact NEXO",
        "primary_href": "../contact.html",
        "secondary_cta": f"Email {CONTACT_EMAIL}",
        "secondary_href": f"mailto:{CONTACT_EMAIL}",
        "body": "privacy",
        "depth": "legal",
    },
    "legal/terms.html": {
        "title": "Terms of Service | NEXO",
        "description": "Terms and service information for NEXO by NEXOGREX S.R.L., including research limitations and client responsibilities.",
        "nav": "Terms",
        "hero_kicker": "TERMS",
        "hero_title": "Terms of Service",
        "hero_text": "Service boundaries, client responsibilities, payment terms, and responsible use notes for NEXO research services.",
        "primary_cta": "Contact NEXO",
        "primary_href": "../contact.html",
        "secondary_cta": f"Email {CONTACT_EMAIL}",
        "secondary_href": f"mailto:{CONTACT_EMAIL}",
        "body": "terms",
        "depth": "legal",
    },
}


def prefix(page: dict) -> str:
    return "../" if page.get("depth") == "legal" else ""


def url_for(path: str) -> str:
    if path == "index.html":
        return BASE_URL
    return BASE_URL + path


def nav_html(current: str, pre: str) -> str:
    links = [f'<a class="nav-link {"active" if current == "Home" else ""}" href="{pre}index.html">Home</a>']
    links += [f'<a class="nav-link {"active" if current == label else ""}" href="{pre}{href}">{label}</a>' for label, href in NAV]
    return "\n".join(links)


def header(page: dict) -> str:
    pre = prefix(page)
    current = page["nav"]
    return f"""
<header class="site-header" data-header>
  <div class="top-strip">
    <span>NEXO by NEXOGREX S.R.L.</span>
    <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>
  </div>
  <nav class="main-nav" aria-label="Primary navigation">
    <a class="brand" href="{pre}index.html" aria-label="NEXO home"><span class="brand-mark">N</span><span>NEXO</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"><span></span><span></span><span></span><span class="sr-only">Menu</span></button>
    <div class="nav-menu" id="nav-menu">
      {nav_html(current, pre)}
      <a class="nav-cta" href="{pre}contact.html">Request a Sprint</a>
    </div>
  </nav>
</header>
"""


def footer(page: dict) -> str:
    pre = prefix(page)
    year = date.today().year
    col1 = ''.join(f'<a href="{pre}{href}">{label}</a>' for label, href in [("Home", "index.html"), ("Services", "services.html"), ("Prospect Intelligence", "prospect-intelligence.html"), ("Process", "process.html")])
    col2 = ''.join(f'<a href="{pre}{href}">{label}</a>' for label, href in [("Solutions", "solutions.html"), ("Data Quality", "data-quality.html"), ("Pricing", "pricing.html"), ("Resources", "resources.html")])
    return f"""
<footer class="site-footer">
  <section class="footer-cta">
    <div>
      <p class="eyebrow">Ready to map your next market?</p>
      <h2>Start with a focused NEXO prospect intelligence sprint.</h2>
    </div>
    <a class="button button-light" href="{pre}contact.html">Request a Sprint</a>
  </section>
  <div class="footer-grid">
    <div>
      <a class="brand footer-brand" href="{pre}index.html"><span class="brand-mark">N</span><span>NEXO</span></a>
      <p>NEXO provides public-source, human-reviewed local prospect intelligence for U.S. agency outreach workflows.</p>
      <p><strong>Contact:</strong> <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></p>
    </div>
    <div><h3>Company</h3><a href="{pre}about.html">About</a><a href="{pre}contact.html">Contact</a><a href="{pre}legal/privacy.html">Privacy</a><a href="{pre}legal/terms.html">Terms</a></div>
    <div><h3>Services</h3>{col1}</div>
    <div><h3>Resources</h3>{col2}</div>
  </div>
  <div class="footer-bottom">
    <span>© {year} NEXOGREX S.R.L. · NEXO</span>
    <span>IDNO / fiscal code: 1025600002590</span>
  </div>
  <p class="footer-note">NEXO is an independent business service. Research outputs are based on publicly available, client-provided, or commercially permissible sources. NEXO does not guarantee sales, meetings, contract awards, procurement eligibility, or agency response.</p>
</footer>
"""


def hero(page: dict) -> str:
    return f"""
<section class="hero hero-inner">
  <div class="hero-bg"></div>
  <div class="container hero-grid">
    <div class="hero-copy" data-reveal>
      <p class="eyebrow">{page['hero_kicker']}</p>
      <h1>{page['hero_title']}</h1>
      <p class="hero-lede">{page['hero_text']}</p>
      <div class="hero-actions">
        <a class="button" href="{page['primary_href']}">{page['primary_cta']}</a>
        <a class="button button-secondary" href="{page['secondary_href']}">{page['secondary_cta']}</a>
      </div>
    </div>
    <div class="dashboard-card" data-reveal data-delay="120" aria-label="NEXO prospect intelligence dashboard preview">
      <div class="dash-header"><span></span><span></span><span></span><strong>NEXO Sprint Board</strong></div>
      <div class="dash-grid">
        <div><small>Market</small><strong>Austin, TX</strong></div>
        <div><small>Niche</small><strong>HVAC</strong></div>
        <div><small>Reviewed</small><strong>125</strong></div>
        <div><small>Priority</small><strong>38</strong></div>
      </div>
      <div class="signal-list">
        <div><span class="score">A</span><p><strong>Website opportunity</strong><br>Outdated mobile experience and missing quote CTA.</p></div>
        <div><span class="score cyan">B</span><p><strong>Visibility signal</strong><br>Weak category pages and limited local search footprint.</p></div>
        <div><span class="score green">✓</span><p><strong>Source checked</strong><br>Public website and business listing reviewed.</p></div>
      </div>
    </div>
  </div>
</section>
"""


def mini_form(source: str, title: str = "Request a NEXO sprint") -> str:
    return f"""
<form class="contact-form" action="{FORM_ACTION}" method="POST" id="contact-form">
  <input type="hidden" name="_subject" value="New NEXO website inquiry - {escape(source)}">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_next" value="{NEXT_URL}">
  <input type="text" name="_honey" class="honey" tabindex="-1" autocomplete="off">
  <input type="hidden" name="Source page" value="{escape(source)}">
  <div class="form-heading"><p class="eyebrow">Contact</p><h2>{title}</h2><p>Tell us the market, niche, and agency offer you want to research. We reply from {CONTACT_EMAIL}.</p></div>
  <div class="form-grid">
    <label>Name<input name="Name" required autocomplete="name" placeholder="Your name"></label>
    <label>Business email<input type="email" name="Email" required autocomplete="email" placeholder="you@agency.com"></label>
    <label>Company<input name="Company" required autocomplete="organization" placeholder="Agency or company"></label>
    <label>Agency type<select name="Agency type" required><option value="">Select one</option><option>Local SEO</option><option>Web design</option><option>PPC / Ads</option><option>Reputation management</option><option>GoHighLevel / CRM</option><option>Lead generation</option><option>Other</option></select></label>
    <label>Target market<input name="Target market" placeholder="e.g. Texas, Miami, U.S. Southeast"></label>
    <label>Business category<input name="Business category" placeholder="e.g. HVAC, roofers, dentists"></label>
    <label class="wide">What should we research?<textarea name="Research brief" rows="5" required placeholder="Tell us your niche, geography, preferred volume, fields, and outreach use case."></textarea></label>
  </div>
  <label class="consent"><input type="checkbox" required name="General inquiry consent" value="Confirmed"> <span>I understand this form is for general business inquiries only and should not be used to submit confidential, controlled, procurement-sensitive, classified, or sensitive personal information.</span></label>
  <button class="button" type="submit">Send inquiry</button>
  <p class="form-note">If the form does not open correctly, email <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>. Submissions may be processed by FormSubmit to deliver your request by email. See our <a href="legal/privacy.html">Privacy Policy</a> for how inquiry information is handled.</p>
</form>
"""


def card(title: str, text: str, icon: str = "✦") -> str:
    return f'<article class="feature-card"><span class="card-icon">{icon}</span><h3>{title}</h3><p>{text}</p></article>'


def section_intro(kicker: str, title: str, text: str) -> str:
    return f'<div class="section-heading" data-reveal><p class="eyebrow">{kicker}</p><h2>{title}</h2><p>{text}</p></div>'


def body(kind: str) -> str:
    if kind == "home":
        return f"""
{section_intro('What NEXO delivers', 'From scattered public signals to a clean prospect pipeline.', 'NEXO gives agency teams a structured research layer before outreach begins.')}
<section class="section"><div class="container cards-4">
{card('Public-source research', 'Business websites, public listings, visible local presence, category context, and source references.', '◎')}
{card('Human-reviewed records', 'Records are checked for fit, duplicates, obvious errors, and useful context before delivery.', '✓')}
{card('Agency-fit signals', 'Signals such as outdated sites, missing CTAs, weak local visibility, or review-response gaps.', '◆')}
{card('CRM-ready output', 'A spreadsheet-ready dataset your team can sort, filter, review, and import into workflow tools.', '↗')}
</div></section>
<section class="section split"><div class="container split-grid"><div>{section_intro('Method', 'Built for outreach preparation, not generic list buying.', 'Generic business lists create cleanup work. NEXO starts with your agency offer, target geography, and qualification criteria, then maps businesses that deserve a closer human sales review.')}<a class="text-link" href="process.html">See the process →</a></div><div class="stacked-panel"><h3>Sprint flow</h3><ol class="number-list"><li>Define target market and category.</li><li>Research public sources.</li><li>Review, clean, and segment records.</li><li>Deliver source-backed prospect intelligence.</li></ol></div></div></section>
<section class="section dark-section"><div class="container split-grid"><div>{section_intro('For agency teams', 'Use NEXO before outbound, audit campaigns, or niche validation.', 'The sprint supports local SEO, web design, PPC, reputation management, GoHighLevel, GBP optimization, lead generation, and home-service marketing teams.')}</div><div class="tag-cloud"><span>Local SEO</span><span>Web Design</span><span>PPC</span><span>Reputation</span><span>GBP</span><span>GoHighLevel</span><span>Lead Gen</span><span>Home Services</span></div></div></section>
<section class="section"><div class="container">{mini_form('Home page', 'Request your first NEXO prospect sprint')}</div></section>
"""
    if kind == "services":
        return f"""
<section class="section"><div class="container cards-3">
{card('Local prospect research', 'Find businesses within a target U.S. market and category using public-source discovery and defined agency-fit criteria.', '01')}
{card('Opportunity signal review', 'Add context such as website gaps, local visibility issues, review activity, service-page presence, or conversion friction.', '02')}
{card('Structured handoff', 'Receive a clean file with practical fields, source references, notes, and segmentation labels for internal review.', '03')}
</div></section>
<section class="section soft-section"><div class="container split-grid"><div>{section_intro('Included fields', 'Research organized for real agency workflows.', 'Each sprint can include business identity, category, location, website, contact path, source URL, observed signal, priority label, notes, and suppression status.')}</div><div class="table-card"><table><tr><th>Field</th><th>Purpose</th></tr><tr><td>Source URL</td><td>Trace where the record came from.</td></tr><tr><td>Signal</td><td>Explain why the business may fit the offer.</td></tr><tr><td>Priority</td><td>Help teams sort the strongest matches first.</td></tr><tr><td>Notes</td><td>Keep context visible for sales review.</td></tr></table></div></div></section>
<section class="section"><div class="container cards-3">{card('Market validation', 'Test one city, state, region, or niche before committing internal outreach resources.', '◌')}{card('Campaign preparation', 'Give outreach teams a cleaner starting point for audits, value propositions, and segmentation.', '↘')}{card('List repair', 'Improve old or generic prospect lists with structure, source checks, and exclusion rules.', '◇')}</div></section>
"""
    if kind == "prospect":
        return f"""
<section class="section"><div class="container split-grid"><div>{section_intro('Signals', 'Visible signals that help prioritize review.', 'NEXO does not claim private buyer intent. We identify public, reviewable context that can help agency teams decide where to spend attention.')}</div><div class="accordion"><details open><summary>Website and conversion presence</summary><p>Mobile usability, outdated design, missing quote CTAs, thin service pages, and limited conversion paths.</p></details><details><summary>Local visibility context</summary><p>Category fit, local listing presence, service-area clarity, and public online footprint.</p></details><details><summary>Reputation and response indicators</summary><p>Public review volume, response activity, and observable reputation-management context.</p></details></div></div></section>
<section class="section soft-section"><div class="container cards-4">{card('Business identity', 'Name, category, location, and public source references.', 'ID')}{card('Contact path', 'Public contact route where available: website form, visible email, or phone.', '@')}{card('Fit notes', 'Short human-readable explanation for the record selection.', '✎')}{card('Priority labels', 'Simple labels to help your team filter and review.', 'A')}</div></section>
<section class="section"><div class="container split-grid"><div class="sample-sheet"><div class="sheet-row head"><span>Business</span><span>Signal</span><span>Priority</span></div><div class="sheet-row"><span>Demo HVAC Co.</span><span>Outdated site + no quote CTA</span><span>A</span></div><div class="sheet-row"><span>Demo Dental Studio</span><span>Missing location pages</span><span>B</span></div><div class="sheet-row"><span>Demo Roofing LLC</span><span>Weak mobile experience</span><span>A</span></div></div><div>{section_intro('Deliverable preview', 'Spreadsheet-ready and clear about limitations.', 'Rows shown are illustrative examples. Actual sprint files include source references and notes so your team can review each record before use.')}</div></div></section>
"""
    if kind == "process":
        steps = [('Define the target', 'Choose the U.S. market, category, ideal customer profile, exclusions, and fields that matter.'), ('Research public sources', 'Gather available business information from public web sources and local discovery points.'), ('Review and clean', 'Reduce duplicates, obvious mismatches, formatting issues, and low-context records.'), ('Score and segment', 'Apply simple priority labels, signal categories, and notes for faster team review.'), ('Deliver and refine', 'Hand off a structured file and discuss any agreed refinements or next sprint scope.')]
        return '<section class="section"><div class="container timeline">' + ''.join(f'<article class="timeline-item"><span>{i}</span><h3>{t}</h3><p>{d}</p></article>' for i,(t,d) in enumerate(steps,1)) + '</div></section>' + f"""
<section class="section soft-section"><div class="container split-grid"><div>{section_intro('Inputs we need', 'A better brief creates a better dataset.', 'Before research starts, tell us your target category, geography, offer, excluded companies, preferred fields, and any quality rules your team uses.')}</div><div class="checklist"><p>✓ Target city, state, or region</p><p>✓ Business category or niche</p><p>✓ Agency service offer</p><p>✓ Exclusions and suppression list</p><p>✓ Desired volume and format</p></div></div></section>
"""
    if kind == "solutions":
        items = [('Local SEO agencies','Find businesses where public visibility signals may suggest an opportunity for review, optimization, or local search support.'),('Web design agencies','Identify businesses with websites that may warrant a closer human sales review.'),('PPC agencies','Build market-specific prospect lists for local categories where paid acquisition may be relevant.'),('Reputation agencies','Review public reputation signals and organize businesses for further qualification.'),('GoHighLevel agencies','Source local business records that can support niche outreach, CRM enrichment, or campaign planning.'),('Home-service marketers','Research contractors, service providers, and local operators across defined U.S. markets.')]
        return '<section class="section"><div class="container cards-3">' + ''.join(card(t, d, '→') for t,d in items) + '</div></section>' + f"""
<section class="section dark-section"><div class="container split-grid"><div>{section_intro('Better targeting', 'Match the sprint to your campaign angle.', 'Whether your offer is an audit, redesign, GBP optimization, ad strategy, or CRM implementation, NEXO adapts the research criteria to your use case.')}</div><a class="button button-light" href="contact.html">Discuss your use case</a></div></section>
"""
    if kind == "quality":
        return f"""
<section class="section"><div class="container cards-4">{card('Public-source only', 'We work with public, client-provided, or commercially permissible sources and do not claim private contact databases.', '◎')}{card('Human review', 'Records are checked for fit, obvious errors, and basic relevance before delivery.', '✓')}{card('Clear structure', 'Data is organized into practical fields your team can sort, filter, and review.', '▦')}{card('No inflated guarantees', 'NEXO does not promise conversion rates, revenue outcomes, or that every business is ready to buy.', '!')}</div></section>
<section class="section soft-section"><div class="container split-grid"><div>{section_intro('Responsible use', 'Designed for B2B research workflows.', 'Clients remain responsible for outreach compliance, opt-out handling, message approval, and final business use. NEXO provides research support, not legal, procurement, or compliance advice.')}</div><div class="notice-card"><h3>Website notice</h3><p>Do not submit confidential, classified, controlled, procurement-sensitive, or sensitive personal information through NEXO forms.</p><a class="text-link" href="legal/privacy.html">Read privacy policy →</a></div></div></section>
"""
    if kind == "pricing":
        plans = [('Focused Sprint','from $350','For testing one niche, city, or campaign angle.','50–75 reviewed prospects|Public-source research|Basic agency-fit signals|Spreadsheet delivery'),('Growth Sprint','from $750','For agencies preparing a larger outbound campaign.','125–200 reviewed prospects|Deeper segmentation|Priority labels|Optional review call'),('Custom Market Build','custom','For multi-city, multi-niche, or recurring research needs.','Custom criteria|Recurring workflows|CRM-aligned delivery|Monthly options')]
        return '<section class="section" id="packages"><div class="container pricing-grid">' + ''.join(f'<article class="pricing-card"><h3>{n}</h3><p class="price">{p}</p><p>{d}</p><ul>' + ''.join(f'<li>{x}</li>' for x in feats.split('|')) + f'</ul><a class="button" href="contact.html">Request quote</a></article>' for n,p,d,feats in plans) + '</div></section>' + f"""
<section class="section soft-section"><div class="container">{mini_form('Pricing page', 'Request pricing for your market')}</div></section>
"""
    if kind == "resources":
        posts = [('How to Define a Local Prospect Market','Choose geography, category, service angle, exclusions, and source rules before research starts.'),('Public Signals Agencies Can Review Before Outreach','Website, local visibility, review activity, service pages, and contactability can help prioritize outreach review.'),('Why Human Review Still Matters','Automation can organize research, but human review helps remove irrelevant or low-context records.'),('Building Better Lists for Local SEO Outreach','Start with niche fit, local visibility context, and source-backed notes before writing audit messages.'),('Common Data Issues in Local Business Research','Duplicates, outdated websites, generic categories, missing source links, and unclear locations all reduce campaign quality.'),('Preparing a Suppression List','Exclude current clients, past outreach, competitors, and blocked domains before a sprint starts.')]
        return '<section class="section" id="resources"><div class="container cards-3 resources-grid">' + ''.join(f'<article class="resource-card"><p class="eyebrow">Guide</p><h3>{t}</h3><p>{d}</p><a class="text-link" href="contact.html">Request this guidance →</a></article>' for t,d in posts) + '</div></section>'
    if kind == "about":
        return f"""
<section class="section"><div class="container split-grid"><div>{section_intro('Company', 'NEXO is operated by NEXOGREX S.R.L.', 'NEXO is built for agencies that need structured local prospect research without relying on generic, unreviewed lists. Our work focuses on public-source collection, practical organization, and human review.')}</div><div class="company-card"><h3>NEXOGREX S.R.L.</h3><p><strong>IDNO / fiscal code:</strong> 1025600002590</p><p><strong>Contact:</strong> <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></p><p><strong>Service:</strong> Local Prospect Intelligence Sprint for U.S. agencies.</p></div></div></section>
<section class="section soft-section"><div class="container cards-3">{card('Clear sources', 'Research records include source context wherever possible.', '1')}{card('Practical structure', 'Outputs are shaped around agency workflow, not generic database exports.', '2')}{card('Responsible boundaries', 'No private-data claims, no guaranteed meetings, and no fake proof.', '3')}</div></section>
"""
    if kind == "contact":
        return f"""
<section class="section"><div class="container contact-layout"><div class="contact-aside"><h2>Contact NEXO</h2><p>Use the form or email us directly at <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.</p><div class="contact-method"><span>Email</span><strong>{CONTACT_EMAIL}</strong></div><div class="contact-method"><span>Company</span><strong>NEXOGREX S.R.L.</strong></div><div class="contact-method"><span>IDNO</span><strong>1025600002590</strong></div><p class="small-note">For best results, include your target geography, niche, desired record volume, and agency service offer.</p></div>{mini_form('Contact page', 'Request sprint scope')}</div></section>
"""
    if kind == "thanks":
        return f"""
<section class="section"><div class="container narrow"><div class="notice-card center"><h2>Thank you — your inquiry was received.</h2><p>NEXO will review your request and respond by email. If you need to add details, send them to <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.</p><a class="button" href="index.html">Return to NEXO</a></div></div></section>
"""
    if kind == "privacy":
        return f"""
<section class="section legal-content"><div class="container narrow"><h2>Privacy Policy</h2><p>Last updated: {date.today().isoformat()}</p><h3>Information we collect</h3><p>When you contact NEXO, we may collect your name, email address, organization, agency type, target market, business category, message, and other details you choose to submit.</p><h3>How we use information</h3><p>We use submitted information to respond to inquiries, scope prospect intelligence services, manage business communications, and maintain records related to potential or active service engagements.</p><h3>Form processing</h3><p>Website forms may be processed by FormSubmit or another form delivery provider so your inquiry can be delivered to {CONTACT_EMAIL}. Do not submit confidential, classified, controlled, procurement-sensitive, or sensitive personal information through the website.</p><h3>No sale of submitted information</h3><p>NEXO does not sell submitted contact information.</p><h3>Retention</h3><p>We keep business inquiry records only as long as needed for communications, service administration, and reasonable business recordkeeping.</p><h3>Contact</h3><p>For privacy questions or deletion requests, contact <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.</p></div></section>
"""
    if kind == "terms":
        return f"""
<section class="section legal-content"><div class="container narrow"><h2>Terms of Service</h2><p>Last updated: {date.today().isoformat()}</p><h3>Service scope</h3><p>NEXO provides public-source, human-reviewed prospect intelligence and related research support for B2B agency workflows. Specific deliverables are defined in the accepted scope, invoice, or written project agreement.</p><h3>Client responsibilities</h3><p>Clients are responsible for reviewing research outputs before use and for ensuring their outreach, advertising, data handling, and communications comply with applicable laws, platform rules, and internal policies.</p><h3>No guarantees</h3><p>NEXO does not guarantee sales, meetings, email deliverability, revenue, contract awards, procurement eligibility, or agency responses.</p><h3>No legal or procurement advice</h3><p>NEXO does not provide legal, procurement, lobbying, compliance, or financial advice. Clients should consult qualified advisors where needed.</p><h3>Payments</h3><p>Services may be invoiced through NEXOGREX S.R.L. by bank transfer or other agreed methods. Work may begin after scope and payment terms are confirmed.</p><h3>Contact</h3><p>For service questions, contact <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.</p></div></section>
"""
    raise KeyError(kind)


def schema_json(page_path: str, page: dict) -> str:
    import json
    org = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "NEXOGREX S.R.L.",
        "alternateName": "NEXO",
        "url": BASE_URL,
        "email": f"mailto:{CONTACT_EMAIL}",
        "brand": {"@type": "Brand", "name": "NEXO"},
        "description": "NEXO provides human-reviewed local prospect intelligence for U.S. agencies using public-source research, opportunity signals, segmentation, and quality checks.",
    }
    web = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": page["title"],
        "url": url_for(page_path),
        "description": page["description"],
        "isPartOf": {"@type": "WebSite", "name": "NEXO", "url": BASE_URL},
        "publisher": {"@type": "Organization", "name": "NEXOGREX S.R.L."},
    }
    return '<script type="application/ld+json">' + json.dumps(org, ensure_ascii=False) + '</script>\n<script type="application/ld+json">' + json.dumps(web, ensure_ascii=False) + '</script>'


def render(path: str, page: dict) -> str:
    pre = prefix(page)
    canonical = url_for(path)
    css = pre + "assets/styles.css"
    js = pre + "assets/app.js"
    favicon = pre + "assets/favicon.svg"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <meta name="author" content="NEXOGREX S.R.L.">
  <meta name="theme-color" content="#071421">
  <title>{page['title']}</title>
  <meta name="description" content="{page['description']}">
  <link rel="canonical" href="{canonical}">
  <meta property="og:site_name" content="NEXO">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="{page['title']}">
  <meta property="og:description" content="{page['description']}">
  <meta property="og:url" content="{canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="{favicon}" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{css}">
  {schema_json(path, page)}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  {header(page)}
  <main id="main">
    {hero(page)}
    {body(page['body'])}
  </main>
  {footer(page)}
  <script src="{js}" defer></script>
</body>
</html>
"""

CSS = r'''
:root{
  --navy:#071421;--navy-2:#0c1f33;--blue:#2563eb;--blue-2:#1d4ed8;--cyan:#22d3ee;--green:#34d399;
  --ink:#102033;--muted:#64748b;--line:#dbe5f0;--soft:#f4f7fb;--white:#fff;--cream:#fbfcfe;
  --shadow:0 22px 70px rgba(7,20,33,.16);--radius:28px;--radius-sm:18px;--max:1180px;
}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:var(--cream);line-height:1.6}a{color:inherit;text-decoration:none}img{max-width:100%;display:block}.container{max-width:var(--max);margin:0 auto;padding:0 24px}.narrow{max-width:860px}.skip-link{position:absolute;left:-999px;top:8px;background:var(--blue);color:#fff;padding:10px 14px;border-radius:10px;z-index:20}.skip-link:focus{left:8px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.site-header{position:sticky;top:0;z-index:15;background:rgba(251,252,254,.88);backdrop-filter:blur(18px);border-bottom:1px solid rgba(219,229,240,.75)}.top-strip{display:flex;justify-content:center;gap:18px;align-items:center;background:var(--navy);color:#d9f8ff;font-size:13px;padding:7px 16px}.top-strip a{color:#fff;text-decoration:underline}.main-nav{max-width:1240px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 24px}.brand{display:flex;align-items:center;gap:10px;font-family:Manrope,sans-serif;font-weight:800;font-size:24px;letter-spacing:-.04em}.brand-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#fff;box-shadow:0 12px 28px rgba(37,99,235,.28)}.nav-menu{display:flex;align-items:center;gap:4px}.nav-link{padding:10px 12px;border-radius:999px;font-size:14px;font-weight:650;color:#334155}.nav-link:hover,.nav-link.active{background:#eaf2ff;color:var(--blue-2)}.nav-cta,.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;font-weight:800;padding:13px 22px;box-shadow:0 18px 40px rgba(37,99,235,.25);cursor:pointer}.nav-cta{margin-left:8px;padding:11px 18px;font-size:14px}.button:hover,.nav-cta:hover{transform:translateY(-1px);box-shadow:0 22px 48px rgba(37,99,235,.32)}.button-secondary{background:#fff;color:var(--navy);box-shadow:inset 0 0 0 1px var(--line)}.button-light{background:#fff!important;color:var(--navy)!important;box-shadow:none}.text-link{color:var(--blue-2);font-weight:800}.nav-toggle{display:none;background:transparent;border:0;gap:5px;flex-direction:column}.nav-toggle span:not(.sr-only){display:block;width:25px;height:2px;background:var(--ink);border-radius:2px}
.hero{position:relative;overflow:hidden;color:#fff;background:radial-gradient(circle at 78% 24%,rgba(34,211,238,.28),transparent 28%),linear-gradient(135deg,#06111f 0%,#0d2842 56%,#0b4b6f 100%)}.hero-bg:before{content:"";position:absolute;inset:auto -10% -140px -10%;height:260px;background:var(--cream);border-radius:50% 50% 0 0/100% 100% 0 0}.hero-grid{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;min-height:640px;padding-top:80px;padding-bottom:120px}.hero h1{font-family:Manrope,sans-serif;font-size:clamp(42px,6vw,76px);line-height:.96;letter-spacing:-.065em;margin:0 0 24px}.hero-lede{font-size:20px;color:#d6e7f5;max-width:720px;margin:0 0 30px}.hero-actions{display:flex;flex-wrap:wrap;gap:14px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:var(--cyan);margin:0 0 16px}.dashboard-card{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);box-shadow:var(--shadow);border-radius:32px;padding:22px;backdrop-filter:blur(22px)}.dash-header{display:flex;align-items:center;gap:8px;margin-bottom:18px}.dash-header span{width:12px;height:12px;border-radius:50%;background:#fff8}.dash-header strong{margin-left:auto;color:#fff}.dash-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.dash-grid div,.signal-list div{background:#fff;border-radius:20px;padding:18px;color:var(--ink)}.dash-grid small{display:block;color:var(--muted);font-weight:700}.dash-grid strong{font-size:24px}.signal-list{display:grid;gap:12px;margin-top:12px}.signal-list div{display:flex;gap:14px;align-items:flex-start}.signal-list p{margin:0}.score{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--blue);color:#fff;font-weight:900}.score.cyan{background:var(--cyan);color:var(--navy)}.score.green{background:var(--green);color:var(--navy)}
.section{padding:96px 0}.soft-section{background:var(--soft)}.dark-section{background:var(--navy);color:#fff}.section-heading{max-width:780px;margin:0 auto 42px;text-align:center}.section-heading h2,.footer-cta h2{font-family:Manrope,sans-serif;font-size:clamp(32px,4.2vw,54px);line-height:1.03;letter-spacing:-.055em;margin:0 0 16px}.section-heading p{color:var(--muted);font-size:18px}.dark-section .section-heading{text-align:left;margin:0}.dark-section .section-heading p{color:#bed4e7}.cards-4,.cards-3{display:grid;gap:20px}.cards-4{grid-template-columns:repeat(4,1fr)}.cards-3{grid-template-columns:repeat(3,1fr)}.feature-card,.resource-card,.pricing-card,.notice-card,.company-card,.stacked-panel,.table-card,.contact-aside{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:28px;box-shadow:0 14px 45px rgba(15,23,42,.06)}.feature-card h3,.resource-card h3,.pricing-card h3{font-family:Manrope,sans-serif;font-size:24px;line-height:1.1;margin:14px 0 10px;letter-spacing:-.035em}.feature-card p,.resource-card p,.pricing-card p{color:var(--muted);margin:0}.card-icon{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:15px;background:#eaf2ff;color:var(--blue);font-weight:900}.split-grid{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center}.number-list{margin:0;padding-left:22px}.number-list li{margin:12px 0}.tag-cloud{display:flex;flex-wrap:wrap;gap:12px}.tag-cloud span{padding:12px 16px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);font-weight:800}.accordion{display:grid;gap:14px}.accordion details{background:#fff;border:1px solid var(--line);border-radius:20px;padding:18px}.accordion summary{font-weight:900;cursor:pointer}.sample-sheet{background:#fff;border-radius:var(--radius);padding:18px;border:1px solid var(--line);box-shadow:var(--shadow)}.sheet-row{display:grid;grid-template-columns:1fr 1.4fr .5fr;gap:10px;padding:14px;border-bottom:1px solid var(--line)}.sheet-row:last-child{border-bottom:0}.sheet-row.head{font-weight:900;color:var(--blue-2)}.timeline{display:grid;gap:18px}.timeline-item{display:grid;grid-template-columns:80px 1fr;gap:22px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px}.timeline-item span{display:grid;place-items:center;width:56px;height:56px;border-radius:18px;background:var(--navy);color:#fff;font-weight:900}.timeline-item h3{margin:0;font-size:26px}.timeline-item p{margin:4px 0 0;color:var(--muted)}.checklist p{background:#fff;border:1px solid var(--line);border-radius:18px;margin:10px 0;padding:16px;font-weight:800}.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.pricing-card{display:flex;flex-direction:column}.price{font-family:Manrope,sans-serif;font-size:44px!important;font-weight:900;color:var(--navy)!important;margin:10px 0!important}.pricing-card ul{padding-left:20px;color:var(--muted)}.pricing-card .button{margin-top:auto}.resources-grid .resource-card{min-height:230px}.contact-layout{display:grid;grid-template-columns:.78fr 1.22fr;gap:28px}.contact-method{padding:18px 0;border-bottom:1px solid var(--line)}.contact-method span{display:block;color:var(--muted);font-weight:700}.contact-method strong{font-size:20px}.small-note,.form-note{font-size:14px;color:var(--muted)}.contact-form{background:#fff;border:1px solid var(--line);border-radius:32px;padding:32px;box-shadow:var(--shadow)}.form-heading h2{font-family:Manrope,sans-serif;font-size:36px;line-height:1;margin:0 0 12px;letter-spacing:-.04em}.form-heading p{color:var(--muted)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.contact-form label{display:grid;gap:7px;font-weight:800;font-size:14px}.contact-form input,.contact-form textarea,.contact-form select{width:100%;border:1px solid var(--line);border-radius:16px;padding:14px 15px;font:inherit;color:var(--ink);background:#fff}.contact-form input:focus,.contact-form textarea:focus,.contact-form select:focus{outline:3px solid rgba(34,211,238,.25);border-color:var(--cyan)}.wide{grid-column:1/-1}.consent{margin:18px 0;grid-template-columns:auto 1fr!important;align-items:flex-start;color:var(--muted);font-weight:600!important}.consent input{width:auto;margin-top:5px}.honey{display:none!important}.legal-content h2{font-family:Manrope,sans-serif;font-size:44px;letter-spacing:-.04em}.legal-content h3{margin-top:34px;font-size:24px}.center{text-align:center}.footer-cta{max-width:var(--max);margin:0 auto;transform:translateY(48px);background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;border-radius:36px;padding:42px;display:flex;align-items:center;justify-content:space-between;gap:24px}.site-footer{background:var(--navy);color:#d8e6f2;margin-top:60px;padding:80px 24px 28px}.footer-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:34px;padding-top:36px}.site-footer h3{color:#fff}.site-footer a{display:block;color:#d8e6f2;margin:8px 0}.footer-brand{color:#fff}.footer-bottom{max-width:var(--max);margin:36px auto 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.16);display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}.footer-note{max-width:var(--max);margin:18px auto 0;color:#9fb4c8;font-size:13px}
[data-reveal]{opacity:1;transform:none;transition:.7s ease}.revealed{opacity:1!important;transform:none!important}
@media (max-width:980px){.nav-toggle{display:flex}.nav-menu{position:absolute;left:18px;right:18px;top:88px;display:none;flex-direction:column;align-items:stretch;background:#fff;border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:var(--shadow)}.nav-menu.open{display:flex}.nav-cta{margin:8px 0 0}.hero-grid,.split-grid,.contact-layout{grid-template-columns:1fr}.hero-grid{min-height:auto;padding-top:70px}.cards-4,.cards-3,.pricing-grid,.footer-grid{grid-template-columns:1fr 1fr}.footer-cta{flex-direction:column;align-items:flex-start}.top-strip{flex-direction:column;gap:2px}.form-grid{grid-template-columns:1fr}}
@media (max-width:640px){.container{padding:0 18px}.main-nav{padding:14px 18px}.hero-grid{padding-bottom:90px}.hero h1{font-size:42px}.section{padding:68px 0}.cards-4,.cards-3,.pricing-grid,.footer-grid{grid-template-columns:1fr}.timeline-item{grid-template-columns:1fr}.sheet-row{grid-template-columns:1fr}.footer-bottom{display:block}.contact-form{padding:24px}.footer-cta{border-radius:24px;padding:28px}}
'''.strip()

JS = r'''
const toggle = document.querySelector('.nav-toggle');
const menu = document.querySelector('.nav-menu');
if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => entry.target.classList.add('revealed'), delay);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
document.querySelectorAll('form.contact-form').forEach((form) => {
  form.addEventListener('submit', () => {
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Sending…';
  });
});
'''.strip()

FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><path d="M17 46V18h8l14 17V18h8v28h-7.5L25 28.5V46z" fill="#fff"/></svg>'''

README = f'''# NEXO Prospect Intelligence Website

Production static website for **NEXO by NEXOGREX S.R.L.**

Live URL: {BASE_URL}

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

Forms post to FormSubmit for delivery to `{CONTACT_EMAIL}` and include a visible mailto fallback. GitHub Pages cannot securely send email directly without a third-party form service or backend. Telegram bot tokens must not be exposed in frontend code.

## Local preview

```bash
python -m http.server 8787
```

Open: <http://127.0.0.1:8787/>

## Deployment

Push `main` to GitHub. GitHub Pages serves the root directory.

## Internal automation

Scripts under `scripts/` and files under `config/` are internal. Do not publish tokens, OAuth files, bot tokens, or chat IDs.
'''

ROBOTS = f'''User-agent: *
Allow: /

Sitemap: {BASE_URL}sitemap.xml
'''

SITEMAP = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{url_for(path)}</loc><lastmod>{date.today().isoformat()}</lastmod><changefreq>{"yearly" if path.startswith("legal/") else "monthly"}</changefreq><priority>{"1.0" if path=="index.html" else "0.8"}</priority></url>\n'
    for path in PAGES
) + '</urlset>\n'

def clean_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()) + "\n"

for path, page in PAGES.items():
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(clean_text(render(path, page)), encoding='utf-8')

(ROOT / 'assets').mkdir(exist_ok=True)
(ROOT / 'assets/styles.css').write_text(CSS + '\n', encoding='utf-8')
(ROOT / 'assets/app.js').write_text(JS + '\n', encoding='utf-8')
(ROOT / 'assets/favicon.svg').write_text(FAVICON + '\n', encoding='utf-8')
(ROOT / 'robots.txt').write_text(ROBOTS, encoding='utf-8')
(ROOT / 'sitemap.xml').write_text(SITEMAP, encoding='utf-8')
(ROOT / 'README.md').write_text(README, encoding='utf-8')
print('Built NEXO static site:', len(PAGES), 'HTML pages')
