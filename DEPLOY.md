# Deploying chatapp

Single-instance deployment (the in-process sweeper/reminder intervals assume
one instance; move them to pg-boss before scaling out).

## What you need

1. **Host** that runs a Docker container or Node server (Railway, Fly.io,
   Render) + **managed Postgres**.
2. **LiveKit Cloud** project (cloud.livekit.io): gives `LIVEKIT_URL`
   (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Set
   `NEXT_PUBLIC_LIVEKIT_URL` to the same wss URL. Configure a webhook to
   `https://YOUR_DOMAIN/api/livekit/webhook` with the same API key.
3. **Stripe**: live (or test) keys; a webhook endpoint
   `https://YOUR_DOMAIN/api/stripe/webhook` subscribed to
   `checkout.session.completed` — its signing secret is
   `STRIPE_WEBHOOK_SECRET`.
4. **Resend** API key + verified sending domain (`EMAIL_FROM`).

## Environment

Copy `.env.example`; every variable is required in production except
`PAYOUT_DELAY_HOURS` (default 24). `BETTER_AUTH_URL` = your public origin.

## Build & run

`NEXT_PUBLIC_LIVEKIT_URL` is baked into the client bundle **at build
time** — pass the real wss URL as a build arg; setting it only at runtime
has no effect on browser code.

```bash
docker build --build-arg NEXT_PUBLIC_LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud -t chatapp .
# run migrations once per deploy, then start
docker run --env-file .env chatapp node scripts/migrate.mjs
docker run --env-file .env -p 3000:3000 chatapp
```

Platform equivalents: release command = `node scripts/migrate.mjs`, start
command = `node server.js`, health check = `GET /api/health`.

## Post-deploy checklist

- [ ] `GET /api/health` returns `{ok: true}`
- [ ] Magic-link email arrives (Resend domain verified)
- [ ] Test booking end-to-end with a Stripe test card
- [ ] LiveKit webhook shows deliveries in the LiveKit dashboard
- [ ] Stripe webhook shows 200s in the Stripe dashboard
- [ ] Set an admin: `UPDATE users SET role='admin' WHERE email='you@…';`
