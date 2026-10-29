# Maple licensing follow-up — 2026-10-28

Historical findings: see [CONTAINER_COMPLIANCE_STATUS.md](CONTAINER_COMPLIANCE_STATUS.md) for subsequent remediation and the owner's confirmation of personal use.

## Intended use and deployment

The owner confirmed in this conversation: “I own the tool. use the website.” This review therefore assumes website access only, not giving users a Docker image or installation copy. Ownership is a user attestation, not an independently verified assignment of copyright. Approval from an employer/organization to use Railway was not supplied.

Railway was rechecked: service `ac807f97-166d-4516-9356-0619a90dbf44`, deployment `ad6a2d42-4747-4db5-b752-edae8521e840`, is live. It uses commit `878d971260ba7618ce5cb4fbb461be4901210043`, with the previously reviewed Node and nginx base digests pinned. The follow-up below has not been deployed or pushed.

## Results of the deeper verification

| Item | Evidence and conclusion |
| --- | --- |
| Runtime package provenance | Retrieved exact APKBUILD recipes for all 53 Alpine source origins represented by the runtime packages. The six nginx packages come from nginx's repository and were previously checked separately. |
| Matching source/patch availability | Downloaded and verified all 254 checksum-listed source/patch inputs in those 53 recipes. GCC's full matching source archive was included. libyuv was verified with the recipe's sorted-file-content checksum, because its archive timestamps are unstable. These are local evidence files, not a public source distribution or a complete reproducible build kit. |
| Runtime license texts | Collected license/copyright/patent texts from the verified source archives, including FreeType's FTL and driver notices, certificate-data MPL notice, GCC GPL texts and runtime exception. Some notices are embedded in source files rather than standalone files. This substantially expands the evidence beyond the six nginx notices originally found in the image. It is not a full per-file license scan. |
| GCC runtime exception | Actual `libgcc/libgcc2.c` and `libstdc++-v3/libsupc++/new_op.cc` headers explicitly reference GPLv3-or-later with the GCC Runtime Library Exception 3.1. The archive includes the corresponding license/exception texts. Alpine's broad source-package license label alone was insufficient to describe this. |
| nginx startup scripts | Four scripts matched the outer image's recorded source revision. The remaining IPv6 script matched the underlying slim image's exact revision `ef5a25a6314e652a2dcfbce6074bef729f4d9639`; its `apk manifest --no-network` difference is upstream, not a Maple modification. The nginx Docker repository's BSD-style license was collected. |
| Node startup script | Matches the exact Docker Node source revision `81f419144a1251854c6d9afb09eaa39928e724e8`; repository MIT license collected. |
| Build tool package metadata | Identified 198 package manifests in installed Node/npm/Corepack/Yarn package locations. Every one declares licensing. This does not enumerate components compiled or bundled inside their executables. The build stage is not copied into the deployed runtime. |
| Build tool notice coverage | 191 of those 198 package roots have a directly collected LICENSE/COPYING/NOTICE-style file. Seven do not, and their README files were also absent from the image under the checked paths. Matching upstream npm tarballs were integrity-verified to investigate the gaps; see the table below. |
| Original Maple code | Current LICENSE reserves rights in original Maple code and expressly preserves third-party rights. The owner has confirmed ownership. Repository records do not independently prove employment/IP assignments or permissions for every historical contribution. |
| Railway terms | Reviewed the published terms dated 2026-04-20: the account holder is responsible for rights in hosted content; someone agreeing on behalf of an organization must be authorized. The terms cannot establish that this user's organization approved the deployment. |

### Seven build-tool notice gaps

These are in the Node build image, not the nginx runtime or browser application. A missing notice is an evidence gap, not by itself a finding that a paid license is required or that the application cannot run.

| Package | Declared license | Further evidence |
| --- | --- | --- |
| `@npmcli/agent@3.0.0` | ISC | No direct notice in the image, published package or root of its registry-recorded source revision. Do not fabricate a copyright notice. |
| `@sigstore/verify@2.1.1` | Apache-2.0 | Matching monorepo root LICENSE retrieved at registry-recorded source revision `b5af5ac566fd569b3585fd5133acee2eb2083dba`; not present as a direct package notice in the image. |
| `eastasianwidth@0.2.0` | MIT | No standalone root notice located in the package/source revision; README credits an original implementation. Attribution/provenance remains unresolved. |
| `err-code@2.0.3` | MIT | Upstream README refers to MIT terms, but no standalone root copyright/license notice located at the matching revision. |
| `imurmurhash@0.1.4` | MIT | Matching published package README includes MIT text. That README was not found in the build image. |
| `spdx-exceptions@2.5.0` | CC-BY-3.0 | Matching upstream README contains SPDX/Linux Foundation attribution and licensing information, absent at the checked image path. |
| `spdx-license-ids@3.0.23` | CC0-1.0 | Matching upstream README identifies CC0 and links to it; no direct notice file in the image. |

## Meaning for the stated website-only use

Users receive Maple's HTML/CSS/JavaScript and their bundled libraries. They do not receive the server OS image through ordinary website access. The published npm notice bundle covers the separately reviewed application dependency inventory.

Running ordinary GPL-covered software on a server does not by itself require releasing the separate Maple application source to website visitors. GPLv3 distinguishes network interaction without a copy transfer from conveying a program. However, copying software to a hosting provider is a separate question, and the GPLv3 hosting-provider provision still refers to compliance for third-party material. GPLv2 and LGPL terms must be assessed under their own text; they cannot simply be treated as GPLv3. No AGPL declaration was identified in the reviewed runtime APK metadata, but this is not an exhaustive scan of every bundled file.

The technical review found no mandatory paid license in the reviewed declarations/texts. It does not establish patent clearance or final legal compliance for every binary, dependency and contractual arrangement.

## Concrete remaining actions

1. **Runtime notice packaging:** turn the collected source evidence into a reviewed runtime-specific notice bundle and include applicable embedded notices/credits. The public supplemental bundle remains the earlier selected nginx/AOM/XZ bundle. Four Alpine origins lacked standalone notice files under the collector rules; certificate data has an embedded MPL notice, while the three Alpine metadata/config/key origins require package-specific interpretation. Presence of an archive containing licenses is evidence, not proof that all required notices are already in the deployed image.
2. **Build-tool notices:** retain the recovered upstream notices with the build environment and resolve the incomplete notice/provenance records for `@npmcli/agent`, `eastasianwidth` and `err-code`, or evaluate an updated toolchain with complete notices. Do not replace missing copyright text with invented authors. The current follow-up does not change the Node image.
3. **Source obligations for the provider:** use the exact recipes, patches and source archives collected here to assess/fulfill any source-delivery obligation applicable to the hosting arrangement. No public source offer was made, and downloading source archives locally does not itself satisfy a source-delivery obligation. No obligation to publish original Maple source was established by this review.
4. **Organization approval, if applicable:** confirm authorization to host/use Maple on Railway and any employer ownership terms. The user's ownership statement has been recorded; organizational approval remains unknown. If this is solely personal use, employer approval may not be applicable.

## Evidence and validation

Local evidence is in `artifacts/railway-license-review/` (ignored by Git):

- `runtime-source-verification-index.json`: exact recipes and verification results for 254 inputs.
- `source-evidence/archives/`: retained matching archives, patches and package source files.
- `runtime-source-license-evidence.txt`: collected source notices/headers, including build/test material; not a deployment-ready notice bundle.
- `build-tool-package-review.json` and `build-notice-*.json`: build package inventory and upstream evidence.
- `nginx-entrypoint-review.json`, `nginx-slim-ipv6-source.json`, `node-entrypoint-review.json`: startup-script comparisons.
- `artifacts/container-licenses/node.json` and `nginx.json`: expanded image evidence, including tool package manifests, README files where present and entrypoint scripts.

The inventory script was extended to collect this evidence and run successfully against both pinned images. No application behavior or deployed license files were changed by this follow-up. This report distinguishes checked evidence from the unresolved items above; it is not organizational/legal sign-off.

## Primary references

- GPLv3 text, sections 0 and 2: https://www.gnu.org/licenses/gpl-3.0.html (also reproduced by the GnuPG project at https://gnupg.org/documentation/manuals/gnupg/Copying.html).
- GCC Runtime Library Exception and scope: https://www.gnu.org/licenses/gcc-exception-3.1.en.html and https://www.gnu.org/licenses/gcc-exception-3.1-faq.html.en . The matching GCC source texts and headers were also inspected directly.
- Railway terms: https://railway.com/legal/terms .
- nginx image licensing guidance: https://hub.docker.com/_/nginx#license .
