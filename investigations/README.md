# Investigations

One-off analyses and prototypes that aren't wired into the live dashboard.
Exploratory by nature — not part of the build or deploy.

## Layout

- `scripts/` — generators (run with `node`)
- `reports/` — generated artifacts (HTML reports + their backing JSON)

## Email revenue attribution (2026-06-29)

Per-campaign email revenue attributed via GA4, mapped to Constant Contact
campaigns with a Green/Yellow/Red confidence flag. See the report for the
full writeup; coverage of the ~$292K FY26 email-attributed revenue is
🟢 46% / 🟡 47% / 🔴 3% / ⚪ 4%.

Pipeline:

```
node investigations/scripts/email-revenue-map.js   # GA4 + BQ -> reports/email-revenue-map.json
node investigations/scripts/gen-report.js          # JSON      -> reports/email-revenue-report.html
```

`email-revenue-map.js` reads credentials from the repo-root `.env` and uses
`netlify/functions/lib/{ga4,bq-email}`. Open `reports/email-revenue-report.html`
in a browser to view results.
