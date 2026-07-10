# Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time env: only presence is needed; real values injected at runtime.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-placeholder-secret-0000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    LIVEKIT_URL=ws://localhost:7880 \
    LIVEKIT_API_KEY=build \
    LIVEKIT_API_SECRET=build-placeholder-secret-0000000000 \
    NEXT_PUBLIC_LIVEKIT_URL=wss://REPLACE_AT_BUILD
RUN npm run build

# Run
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Migrations run before start (drizzle-kit needs source migrations)
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db/schema.ts ./src/db/schema.ts
COPY --from=builder /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

EXPOSE 3000
CMD ["node", "server.js"]
