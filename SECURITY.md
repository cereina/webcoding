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
npm test
npm run build
```

`security:audit` fails on high or critical npm advisories. `security:licenses` fails when an installed dependency has no usable license information or introduces a license that requires explicit legal review.

### Known transitive advisory

Mammoth currently depends on `argparse@1.x`, which depends on `sprintf-js@1.0.x`. The current `sprintf-js` denial-of-service advisory has no patched release in that dependency line. Maple imports Mammoth's browser build and does not pass document content to `sprintf-js` format strings directly. This advisory is therefore tracked as an accepted transitive build/dependency risk until Mammoth or its dependency chain removes or patches it. Do not use `npm audit fix --force` to downgrade Mammoth.

## Deployment requirements

The provided Nginx configuration sends CSP, clickjacking, referrer, permissions, MIME-sniffing, cross-origin and HSTS headers. If Maple must be embedded by a WCMS on a different origin, IT must replace the CSP `frame-ancestors 'self'` directive with the exact approved WCMS origin(s); do not use a wildcard.

The Dockerfile pins Node and Nginx image versions. IT should still scan the final image in its approved container-scanning platform and update those pinned versions regularly.

## Repository controls

For an organizational deployment, protect `main` so changes require a pull request and successful security/quality checks. Keep secrets and environment files out of source control. The repository already ignores `.env` and `.env.*` files.

## Reporting

Do not put sensitive document contents, credentials, personal information, or security exploit details in a public issue. Report security issues through the organization's approved private security channel.
