# Security

## Security model

Maple Document Studio is designed as a browser-side document conversion and HTML editing tool. Word files, pasted HTML, and embedded images are processed in the user's browser; the application does not require a document-upload API.

Imported and pasted HTML is sanitized before preview and export. The live preview is sandboxed and does not receive script permission. Word conversion runs in a dedicated Web Worker so malformed documents cannot block the main UI indefinitely.

## DOCX limits

Before Mammoth processes a `.docx`, Maple checks the ZIP central directory and rejects:

- files larger than 10 MB;
- ZIP64 and multi-part archives;
- encrypted/password-protected archives;
- archives with more than 5,000 entries;
- archives that expand beyond 200 MB;
- individual entries larger than 50 MB;
- suspicious compression ratios;
- unsafe archive paths; and
- archives missing the standard Word document parts.

Word conversion is also stopped if it exceeds the client-side timeout.

## Dependency policy

Production builds must run:

```sh
npm ci
npm run security:audit
npm run licenses
npm run security:licenses
npm run typecheck
npm run build
```

`security:audit` fails on moderate, high, or critical npm advisories. `security:licenses` fails when an installed dependency has no usable license information or introduces a license that requires explicit legal review.

Maple pins DOMPurify to the patched version used by both the application and Monaco, pins `source-map-js` to its patched release, and overrides Mammoth's CLI-only `argparse@1.x` dependency with the backwards-compatible `argparse@2.0.1`. Mammoth's browser conversion path does not use the CLI parser, while argparse 2 retains the version-1 compatibility API. This removes the vulnerable `sprintf-js` dependency from the installed tree without downgrading or modifying Mammoth's browser converter.

Do not use `npm audit fix --force`; security dependency changes must be explicit, reviewed, and tested.

## Deployment requirements

The provided Nginx configuration sends CSP, clickjacking, referrer, permissions, MIME-sniffing, cross-origin and HSTS headers. If Maple must be embedded by a WCMS on a different origin, IT must replace the CSP `frame-ancestors 'self'` directive with the exact approved WCMS origin(s); do not use a wildcard.

The Dockerfile pins Node and Nginx image versions. IT should still scan the final image in its approved container-scanning platform and update those pinned versions regularly.

## Repository controls

For an organizational deployment, protect `main` so changes require a pull request and successful security/quality checks. Keep secrets and environment files out of source control. The repository already ignores `.env` and `.env.*` files.

## Regression testing

Security-focused tests for sanitization, DOCX archive limits, and WET-BOEW footnote conversion are blocking CI checks. The complete historical regression suite also runs on every CI execution; any older unrelated failures remain visible while they are addressed separately rather than weakening the security gate.

## Reporting

Do not put sensitive document contents, credentials, personal information, or security exploit details in a public issue. Report security issues through the organization's approved private security channel.
