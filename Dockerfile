# SHYMKENT STUDIO — portable production image (Next.js standalone server).
#
#   docker build -t shymkent-studio .
#   docker run --env-file .env.production -p 3000:3000 shymkent-studio
#
# Migrations are applied by a separate one-off command before starting a new
# version (see docs/DEPLOYMENT.md):
#   docker run --rm --env-file .env.production shymkent-studio npx prisma migrate deploy
# The outbox worker can run from the same image:
#   docker run --env-file .env.production shymkent-studio node scripts-dist/outbox-worker.js

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
# Public values are baked into the client bundle at build time.
ARG NEXT_PUBLIC_SITE_URL=https://shymkent.studio
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npx prisma generate && npm run build \
  && npm run build:worker

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app && useradd --system --gid app --home /app app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/scripts-dist ./scripts-dist
# Prisma CLI + engines for `prisma migrate deploy`, and runtime deps of the worker.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
