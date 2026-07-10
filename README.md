# chatapp

A marketplace for paid 1:1 video calls between creators and their audience.
Creators publish availability on a calendar; fans book a slot or call instantly
when the creator is online. Call time is tracked server-side and billed.

Work in progress. See [plan.md](plan.md) for the architecture and phased build plan.

## Status

Core product works end to end in test mode:

- [x] Magic-link auth (better-auth)
- [x] Creator onboarding, public `/@handle` pages, profile editing
- [x] Availability engine: weekly rules, blackout days, buffers,
      per-creator notice/horizon, timezone/DST-tested slot generation
- [x] Booking flow with database-enforced double-booking prevention,
      approval mode, cancellation policy
- [x] Payments: Stripe Checkout, webhooks, refunds, Connect payouts
      (80/20 split, 24h escrow)
- [x] Timed video calls (LiveKit): server-side billing clock,
      reconnect grace, hard stop at slot end, presence reconciler
- [x] Instant calls: presence, ringing, auth hold at ring,
      per-minute capture at settle
- [x] Transactional emails and T-60 reminders (Resend or console)
- [x] Trust & safety: reports, blocks, suspension, admin queue
- [x] Policy pages, CI, Dockerfile + deploy runbook (see DEPLOY.md)

Pre-launch checklist: Stripe platform pre-approval, Resend key +
domain, production hosting + LiveKit Cloud, legal review of policies.

## Stack

Next.js (App Router) · TypeScript · Postgres · Drizzle ORM · better-auth ·
Tailwind · Stripe Connect · LiveKit · Resend.

## Development

Requires Node 20+ and a local Postgres.

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and BETTER_AUTH_SECRET
createdb chatapp_dev
npx drizzle-kit migrate
npm run dev
```

Generate an auth secret with `openssl rand -hex 32`.

In development, magic-link sign-in URLs are printed to the server console
instead of being emailed.

```bash
npm test          # unit tests (slot generation, DST edge cases)
npm run build     # production build
```

## License

MIT — see [LICENSE](LICENSE).
