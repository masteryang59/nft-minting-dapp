# syntax=docker/dockerfile:1
# One image for the chain and the deployer, plus an nginx stage for the built frontend.

FROM node:22.21-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY . .
# Art, metadata and allowlist proofs (deterministic), then the contracts.
RUN node scripts/generate-collection.ts && npx hardhat build

FROM base AS web-build
RUN npm run build -w frontend

FROM nginx:1.29-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/frontend/dist /usr/share/nginx/html
# deployment.json is written at runtime by the deploy service into a shared volume.
RUN rm -f /usr/share/nginx/html/deployment.json
ENV ROLLBACK_CHANGES=true
ENV ROLLBACK_CHANGES=true
ENV DESTROY_SESSION=true