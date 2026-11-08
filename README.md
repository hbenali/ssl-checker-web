# SSL Chain Checker

A free, single-page SSL/TLS certificate chain checker. Verify whether a domain's certificate chain is trusted and complete, and get the correct chain to install if it isn't. Live at [ssl.hbenali.ovh](https://ssl.hbenali.ovh).

No backend, no build step — a static `index.html` plus `site.css`, `fonts/` and `assets/js`, calling a public API directly from the browser.

## Features

- **Check** any domain's TLS certificate chain
- **Trust status** — flags untrusted or expired chains
- **Recommended chain** — get the correct intermediate chain to install when it's broken, with one-click copy
- **Shareable links** — copy a link that reopens the same check
- **Dark editorial design**, self-hosted fonts, no third-party requests except the SSLMate API
- Fully responsive and accessible (labeled fields, live regions, WCAG AA contrast)

## Running locally

No build step required — just serve the directory:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Data sources

All lookups happen client-side against a free public API:

- [SSLMate's "What's My Chain Cert?"](https://whatsmychaincert.com/) — certificate chain evaluation

## Deployment

Deployed automatically to GitHub Pages on every push to `master` (see `.github/workflows/`).

## License

MIT — see [LICENSE](LICENSE).
