# Container package inventory — 2026-10-28

Declared package metadata from the exact Linux amd64 base images recorded in Railway build logs. This is not a complete SBOM or legal clearance. The counts are per image and overlap; do not add them together as unique dependencies.

## Runtime nginx image

Base digest: `sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94`

Platform digest: `sha256:8f84ed99befc3891b8f329c5c202785278a2cfb7c25107d57fb2a134a3117433`

| Package | Version | Declared license |
| --- | --- | --- |
| alpine-baselayout | 3.7.2-r1 | GPL-2.0-only |
| alpine-baselayout-data | 3.7.2-r1 | GPL-2.0-only |
| alpine-keys | 2.6-r0 | MIT |
| alpine-release | 3.24.2-r0 | MIT |
| aom-libs | 3.14.1-r0 | BSD-2-Clause AND custom |
| apk-tools | 3.0.8-r0 | GPL-2.0-only |
| brotli-libs | 1.2.0-r1 | MIT |
| busybox | 1.37.0-r31 | GPL-2.0-only |
| busybox-binsh | 1.37.0-r31 | GPL-2.0-only |
| c-ares | 1.34.8-r0 | MIT |
| ca-certificates | 20260909-r0 | MPL-2.0 AND MIT |
| ca-certificates-bundle | 20260909-r0 | MPL-2.0 AND MIT |
| curl | 8.22.0-r0 | curl |
| fontconfig | 2.17.1-r1 | MIT |
| freetype | 2.14.3-r0 | FTL OR GPL-2.0-or-later |
| geoip | 1.6.12-r6 | LGPL-2.1-or-later |
| gettext-envsubst | 1.0-r0 | GPL-3.0-or-later AND LGPL-2.1-or-later AND MIT |
| libapk | 3.0.8-r0 | GPL-2.0-only |
| libavif | 1.4.1-r0 | BSD-2-Clause |
| libbsd | 0.12.2-r0 | BSD-3-Clause |
| libbz2 | 1.0.8-r6 | bzip2-1.0.6 |
| libcrypto3 | 3.5.8-r0 | Apache-2.0 |
| libcurl | 8.22.0-r0 | curl |
| libdav1d | 1.5.3-r0 | BSD-2-Clause |
| libedit | 20260508.3.1-r1 | BSD-3-Clause |
| libexpat | 2.8.4-r0 | MIT |
| libgcc | 15.2.0-r5 | GPL-2.0-or-later AND LGPL-2.1-or-later |
| libgd | 2.3.3-r10 | GD |
| libice | 1.1.2-r0 | X11 |
| libidn2 | 2.3.8-r0 | GPL-2.0-or-later OR LGPL-3.0-or-later |
| libintl | 1.0-r0 | LGPL-2.1-or-later |
| libjpeg-turbo | 3.1.3-r0 | BSD-3-Clause AND IJG AND Zlib |
| libmd | 1.2.0-r0 | BSD-3-Clause AND BSD-2-Clause AND ISC AND Beerware AND Public Domain |
| libncursesw | 6.6_p20260516-r0 | X11 |
| libpng | 1.6.58-r1 | Libpng |
| libpsl | 0.21.5-r3 | MIT |
| libsharpyuv | 1.6.0-r0 | BSD-3-Clause |
| libsm | 1.2.6-r0 | MIT |
| libssl3 | 3.5.8-r0 | Apache-2.0 |
| libstdc++ | 15.2.0-r5 | GPL-2.0-or-later AND LGPL-2.1-or-later |
| libunistring | 1.4.2-r0 | GPL-2.0-or-later OR LGPL-3.0-or-later |
| libuuid | 2.42.3-r1 | BSD-3-Clause |
| libwebp | 1.6.0-r0 | BSD-3-Clause |
| libx11 | 1.8.13-r0 | X11 |
| libxau | 1.0.12-r0 | MIT |
| libxcb | 1.17.0-r2 | MIT |
| libxdmcp | 1.1.5-r1 | MIT |
| libxext | 1.3.7-r0 | MIT |
| libxml2 | 2.13.9-r2 | MIT |
| libxpm | 3.5.19-r0 | X11 |
| libxslt | 1.1.43-r3 | X11 |
| libxt | 1.3.1-r0 | MIT |
| libyuv | 0.0.1928-r0 | BSD-3-Clause |
| musl | 1.2.6-r2 | MIT |
| musl-utils | 1.2.6-r2 | MIT AND BSD-2-Clause AND GPL-2.0-or-later |
| ncurses-terminfo-base | 6.6_p20260516-r0 | X11 |
| nghttp2-libs | 1.69.0-r0 | MIT |
| nginx | 1.30.5-r1 | 2-clause BSD-like license |
| nginx-module-acme | 1.30.5.0.4.1-r1 | 2-clause BSD-like license |
| nginx-module-geoip | 1.30.5-r1 | 2-clause BSD-like license |
| nginx-module-image-filter | 1.30.5-r1 | 2-clause BSD-like license |
| nginx-module-njs | 1.30.5.1.0.1-r1 | 2-clause BSD-like license |
| nginx-module-xslt | 1.30.5-r1 | 2-clause BSD-like license |
| pcre2 | 10.48-r0 | BSD-3-Clause |
| scanelf | 1.3.9-r1 | GPL-2.0-only |
| ssl_client | 1.37.0-r31 | GPL-2.0-only |
| tiff | 4.7.1-r0 | libtiff |
| tzdata | 2026d-r0 | Public-Domain |
| xz-libs | 5.8.4-r0 | GPL-2.0-or-later AND 0BSD AND Public-Domain AND LGPL-2.1-or-later |
| zlib | 1.3.2-r0 | Zlib |
| zstd-libs | 1.5.7-r2 | BSD-3-Clause OR GPL-2.0-or-later |

## Build-only Node image

Base digest: `sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`

Platform digest: `sha256:2c752226d477b4a886378baa95b9af252be59301b725fdb0b7e15208131505a8`

| Package | Version | Declared license |
| --- | --- | --- |
| alpine-baselayout | 3.7.2-r1 | GPL-2.0-only |
| alpine-baselayout-data | 3.7.2-r1 | GPL-2.0-only |
| alpine-keys | 2.6-r0 | MIT |
| alpine-release | 3.24.2-r0 | MIT |
| apk-tools | 3.0.8-r0 | GPL-2.0-only |
| busybox | 1.37.0-r31 | GPL-2.0-only |
| busybox-binsh | 1.37.0-r31 | GPL-2.0-only |
| ca-certificates-bundle | 20260909-r0 | MPL-2.0 AND MIT |
| libapk | 3.0.8-r0 | GPL-2.0-only |
| libcrypto3 | 3.5.8-r0 | Apache-2.0 |
| libgcc | 15.2.0-r5 | GPL-2.0-or-later AND LGPL-2.1-or-later |
| libssl3 | 3.5.8-r0 | Apache-2.0 |
| libstdc++ | 15.2.0-r5 | GPL-2.0-or-later AND LGPL-2.1-or-later |
| musl | 1.2.6-r2 | MIT |
| musl-utils | 1.2.6-r2 | MIT AND BSD-2-Clause AND GPL-2.0-or-later |
| scanelf | 1.3.9-r1 | GPL-2.0-only |
| ssl_client | 1.37.0-r31 | GPL-2.0-only |
| zlib | 1.3.2-r0 | Zlib |
