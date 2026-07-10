# Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are BAKED INTO THE CLIENT BUNDLE at build time —
# pass the real value here; runtime env cannot change it.
ARG NEXT_PUBLIC_LIVEKIT_URL=wss://SET_ME_AT_BUILD
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
# Server-only vars: only presence is needed at build; real values at runtime.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-placeholder-secret-0000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    LIVEKIT_URL=ws://localhost:7880 \
    LIVEKIT_API_KEY=build \
    LIVEKIT_API_SECRET=build-placeholder-secret-0000000000
RUN npm run build

# Run
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Migration runner: drizzle SQL + drizzle-orm migrator + postgres driver.
# (standalone output already includes drizzle-orm and postgres, but keep
# explicit copies so the migrator never depends on Next's tracing.)
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres

EXPOSE 3000
CMD ["node", "server.js"]
