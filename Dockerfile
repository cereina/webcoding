FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS node_tool
FROM nginx:1.30.5-alpine3.24@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94 AS build
COPY --from=node_tool /usr/local/bin/node /usr/local/bin/node
COPY --from=node_tool /usr/local/LICENSE /usr/local/share/licenses/node/LICENSE
WORKDIR /app
ENV PATH="/app/node_modules/.bin:${PATH}"
COPY package.json package-lock.json ./
COPY scripts/install-locked-container.mjs ./scripts/install-locked-container.mjs
RUN test ! -e /usr/local/lib/node_modules/npm \
    && test ! -e /usr/local/lib/node_modules/corepack \
    && ! command -v yarn \
    && node scripts/install-locked-container.mjs
COPY . .
RUN node --test tests/container-installer.test.js \
    && node scripts/prepare-container-compliance.mjs \
    && cp /usr/local/share/licenses/node/LICENSE public/compliance/NODE_BUILD_LICENSES.txt \
    && node scripts/generate-third-party-licenses.mjs \
    && node scripts/check-third-party-licenses.mjs \
    && tsc --noEmit \
    && vite build

FROM nginx:1.30.5-alpine3.24@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
ENV PORT=8080
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
