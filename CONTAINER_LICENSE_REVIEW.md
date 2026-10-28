# Railway container license review

Reviewed 2026-10-28. This records technical evidence and unresolved questions; it is not a legal compliance certification.

## Deployment and evidence

- Railway service: maple, production, deployment `ab6be044-4e45-47bd-bce7-89d46c5ba824` (still the latest successful deployment when checked).
- Deployed application commit: `ad73cff8d9e32123817dfac0df72b02247731291`.
- Live npm bundle: https://maple-production-cc9e.up.railway.app/THIRD_PARTY_LICENSES.txt . It documents 87 installed packages, all with collected notice blocks. The build license check passed. This includes the Linux native packages; the prior Windows-only inventory limitation no longer applies to those installed npm packages.
- Runtime base: `nginx:1.30.5-alpine3.24@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94`.
- Build base: `node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`.

The public base manifests/configuration/layers were downloaded by these build-log digests. SHA256 hashes were verified before inspecting their contents. Their Linux amd64 package databases were read without executing container code. The final private Railway image was not downloaded. The inference that the base OS inventory applies to the application image rests on the deployed Dockerfile: the final stage adds only nginx configuration and the compiled `dist` directory, with no OS package installation/removal. Runtime changes outside that recipe were not inspected.

## Findings

| Area | Result |
| --- | --- |
| Application npm dependencies | 87 packages, each with notice text; published Monaco notices also checked. |
| Runtime OS inventory | 71 packages with nonempty declared license metadata; see CONTAINER_LICENSE_INVENTORY.md. |
| Build-stage OS inventory | 18 packages with nonempty declared license metadata. These overlap with runtime packages and are not an additional 18 unique dependencies. |
| nginx and five modules | Their six packaged COPYRIGHT files are present in the base image; copies are included in the supplemental notice file. |
| Node build tools | Node's `/usr/local/LICENSE`, npm, Corepack and Yarn notice files were collected. These tools are outside the APK database. No full nested build-tool dependency audit was performed. The Node stage is not copied into the final runtime image. |
| AOM `BSD-2-Clause AND custom` | Inspected libaom 3.14.1 source LICENSE and PATENTS. The custom term is the AOM Patent License 1.0, with no-charge/royalty-free grants subject to conditions, including reciprocity and defensive termination. It is not an unconditional patent clearance. Both texts are preserved in supplemental notices. |
| XZ `xz-libs` | Inspected XZ 5.8.4 COPYING: liblzma is 0BSD; the source package also contains differently licensed utilities. This demonstrates why broad Alpine metadata cannot determine each binary's exact terms. COPYING and COPYING.0BSD are preserved. The npm LZMA exclusion does not mean the OS image contains no liblzma. |
| Mandatory paid license | None identified in the reviewed declarations and texts. This does not certify every bundled file or patent right. |

AOM and XZ archive SHA512 checksums matched their exact Alpine APKBUILD source checksums, retrieved using the installed packages' source commit IDs. The collected evidence is under `artifacts/railway-license-review/` locally (ignored by Git). The committed inventory preserves the package/version/license mapping.

## Remaining limitations and decisions

1. Only six matching license/copyright files were found in the runtime base under the collector's filename rules, all for nginx/modules. The package database supplies other license declarations, not complete copyright notices. Absence of a matching file is not proof of infringement, but the current evidence cannot certify all notice obligations as satisfied.
2. Complete notice/source compliance for redistributing the whole container remains unverified. GPL/LGPL components include BusyBox, apk-tools, gettext and others; notices, corresponding source, modifications and applicable exceptions must be assessed for the actual distribution arrangement. Merely adding a generic GPL text is not a substitute for that work. Hosting and distributing a container are different scenarios; uploading to a provider should be assessed in the organization's context.
3. Broad metadata for GCC runtime libraries, musl utilities and other bundled software still needs file-level interpretation if a complete redistribution clearance is required. The Node/npm/Yarn toolchain and unpackaged entrypoint scripts are not a complete transitive source audit.
4. No scan of all source files, proprietary code ownership, organization policy, patent position or Railway service terms was performed. No AGPL/SSPL/paid-only declaration was seen in the APK inventory, but metadata alone is not proof of absence from every bundled component.

The findings do not show that Maple must be open-sourced merely because these separate server tools are present. They also do not support a promise that all licensing obligations are resolved. For organizational sign-off, give this evidence and the deployment/distribution arrangement to the organization's open-source compliance owner.

## Changes prepared locally

- `public/CONTAINER_THIRD_PARTY_NOTICES.txt` supplements npm notices with the six nginx/module notices and verified AOM/XZ texts. It explicitly states that it is a selected, not complete, container notice bundle. It is tied to the audited image and must be refreshed when the image changes.
- `scripts/inventory-container.py` collects package metadata and packaged notices for an exact public Docker Hub digest (preferred for deployment reviews), or records the digest resolved from a tag. It checks download hashes and fails on missing APK package names/licenses.
- `scripts/inventory-dockerfile.py` inventories both current Dockerfile base images. It rejects unsupported FROM syntax instead of silently ignoring a stage.
- `.github/workflows/container-licenses.yml` is prepared to run on relevant PRs/pushes, weekly and manually, retaining JSON evidence for 90 days. A successful run means evidence collection succeeded, not that licenses were legally approved. It is not active until committed and pushed. It does not gate Railway deployments automatically.

At the conclusion of the initial review, no Railway deployment or GitHub push had been performed. A subsequent user-authorized deployment publishes these supplemental notices. The Dockerfile now pins both base images to the exact reviewed digests; future image updates require a fresh review.

Validation: both exact-digest inventories completed with verified downloads; the Dockerfile-driven command also completed and resolved the same digests (18 Node-stage and 71 nginx-stage APK packages). Python syntax checks passed. `npm run build` passed license validation, TypeScript checking and production bundling, with the existing large-chunk warning. The supplemental notice file was verified byte-for-byte in the production output. The GitHub workflow itself has not run remotely.

## Repeat the checks

Requires Python 3.9+ with HTTPS access; no Docker daemon or extra Python packages are needed.

```powershell
python scripts/inventory-dockerfile.py
python scripts/inventory-container.py --repository library/nginx --digest sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94 --output artifacts/railway-license-review/nginx-runtime-inventory.json
```

For a later deployment, obtain its actual base image digests from the Railway build logs. A tag resolved today is not proof of an earlier deployed image. Compare package versions/licenses, refresh notice texts from matching source versions, and retain the evidence with each release. Revisit the scope if the final Docker stage starts installing other software.

## Primary references

- Official nginx image licensing guidance: https://hub.docker.com/_/nginx#license
- nginx license: https://nginx.org/LICENSE
- AOM patent terms: https://aomedia.org/license/patent-license/
- AOM source inspected: https://storage.googleapis.com/aom-releases/libaom-3.14.1.tar.gz
- XZ source inspected: https://github.com/tukaani-project/xz/archive/refs/tags/v5.8.4/xz-5.8.4.tar.gz
- GNU licensing FAQ (hosting/distribution and aggregation distinctions): https://www.gnu.org/licenses/gpl-faq.html
- Registry manifest API: https://docs.docker.com/reference/api/registry/latest/operations/GetImageManifest/
