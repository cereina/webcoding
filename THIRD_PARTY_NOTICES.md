# Third-party software notices

Maple Document Studio uses third-party open-source software. Those components remain licensed by their respective authors and are not covered by Maple's project-level rights notice.

## Automatic license bundle

Run:

```sh
npm ci
npm run licenses
```

This generates `public/THIRD_PARTY_LICENSES.txt` from the exact packages installed in `node_modules`. The production build runs this automatically before Vite builds the application, so the generated notice file is copied into `dist/` and deployed with Maple.

The generator records each installed package's name, version, declared license expression, project/repository information when available, and packaged LICENSE / LICENCE / COPYING / NOTICE text when present.

## Direct project dependencies

The direct dependencies currently declared by Maple are:

- DOMPurify
- Mammoth
- Monaco Editor
- parse5
- Vite
- jsdom
- tsx
- TypeScript
- @types/node

Their transitive dependencies are also included by the automatic generator when installed.

## Monaco Editor

Monaco includes additional bundled third-party material with its own attribution requirements. Maple keeps the upstream Monaco files separately in `public/`:

- `monaco-LICENSE.txt`
- `monaco-ThirdPartyNotices.txt`

These files are copied into production builds unchanged.

## Project code

Maple's original project code is covered by the repository-level `LICENSE` notice. Third-party licenses take precedence for their respective components.

## Keeping notices current

Whenever dependencies are added, removed, or upgraded, run `npm ci` followed by `npm run licenses`, or run `npm run build` (which runs the generator automatically). Do not manually edit the generated `public/THIRD_PARTY_LICENSES.txt`; regenerate it from installed packages instead.
