# Dependency license review

For the subsequent Railway Linux/container review dated 2026-10-28, see [CONTAINER_LICENSE_REVIEW.md](CONTAINER_LICENSE_REVIEW.md). It supplements this historical Windows npm review and records remaining container compliance limitations.

Scope: current local Windows installation of Maple Document Studio, based on main commit 3ac8ebe and package-lock.json. This is a technical evidence review, not a legal compliance opinion or security audit.

## Result

All 89 installed packages declare no-fee open-source licensing options. No mandatory paid license was identified. Local use is supported by the reviewed license grants. The identified npm notice gap is resolved: dingbat-to-unicode was updated from 1.0.1 to 1.0.2, which includes its upstream BSD-2-Clause copyright/license notice. All 89 installed packages now have collected notice text. This is not a blanket legal clearance for every deployment environment.

The lockfile contains 158 dependency entries; 69 are not installed on this platform and their package contents were not inspected. A Linux/Railway build needs its own inventory. Docker base images (Node, nginx, Alpine and OS packages), service terms, imported document rights, and organizational approvals are not covered by this npm review. No deployment was performed.

## Direct dependencies

| Dependency | Installed version | Declared license |
| --- | --- | --- |
| DOMPurify | 3.4.17 | MPL-2.0 OR Apache-2.0 |
| Mammoth | 1.12.3 | BSD-2-Clause |
| Monaco Editor | 0.56.0 | MIT |
| parse5 | 8.0.1 | MIT |
| Vite | 7.3.7 | MIT |
| jsdom | 26.1.0 | MIT |
| tsx | 4.23.13 | MIT |
| TypeScript | 7.0.2 | Apache-2.0 |
| @types/node | 22.20.3 | MIT |

Transitive licenses include MIT, MIT-0, BSD-2-Clause, BSD-3-Clause, ISC, Python-2.0, Apache-2.0, and MIT AND Zlib. JSZip offers MIT OR GPL-3.0-or-later; MIT is an available option. DOMPurify offers an Apache-2.0 option. An AND expression requires both licenses, unlike OR. Monaco's bundled material includes additional attribution terms (including CC-BY-4.0); its full upstream ThirdPartyNotices.txt is retained. TypeScript's NOTICE.txt and the platform compiler package's notices are collected. These license options do not require making the original Maple application open source merely because it uses these libraries.

## Notice corrections made locally

- Recognize hyphenated/underscored license names, including LICENSE-MIT.txt and LICENSE-MPL.
- Include isarray's README, which contains its MIT notice.
- Include Pako's Zlib copyright/license headers in addition to its top-level MIT license.
- Include Monaco's bundled ThirdPartyNotices.txt; existing public Monaco notices match the installed package after newline normalization.
- Include parent esbuild/Rollup license texts for installed platform binaries.
- Preserve saxes 6.0.0's upstream ISC notice at licenses/saxes-6.0.0.txt. Source: https://raw.githubusercontent.com/lddubeau/saxes/211fa0ebec9b628affc09219199639887174bfc3/LICENSE (revision supplied by npm metadata).
- Report the number of packages actually inspected rather than all lockfile entries. Warn for missing collected text even where package.json declares a license.

## Resolved notice issue

Updated only dingbat-to-unicode from 1.0.1 to compatible patch release 1.0.2 in package-lock.json. The published npm package includes LICENSE with Copyright (c) 2021, Michael Williamson, and the complete BSD-2-Clause terms. Upstream release source: https://github.com/mwilliamson/dingbat-to-unicode/blob/9eb2d1d8b8463b7bd3cd125597eabcfa9df42128/js/LICENSE . The previous version's missing notice was not fabricated or replaced with a generic template. The generated public notice bundle now contains this upstream text, and no installed package remains without collected license text.

## Obligations when sharing

Retain applicable copyright, license, disclaimer and attribution notices. For Apache-covered files, preserve relevant NOTICE material and mark distributed modifications. For Zlib-covered source, retain notices and identify altered source. Retain bundled attribution material. The project-level all-rights-reserved LICENSE applies to original Maple code and does not override third-party grants; ownership and permission for that original code were not independently audited.

References: https://opensource.org/license/mit ; https://opensource.org/license/bsd-2-clause ; https://www.apache.org/licenses/LICENSE-2.0 . The generated public/THIRD_PARTY_LICENSES.txt is the package-by-package inventory. Regenerate after dependency changes. The metadata checker remains a heuristic, not a legal clearance engine.
