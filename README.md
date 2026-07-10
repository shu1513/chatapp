# chatapp

A marketplace for paid 1:1 video calls between creators and their audience.
Creators publish availability on a calendar; fans book a slot or call instantly
when the creator is online. Call time is tracked server-side and billed.

Work in progress. See [plan.md](plan.md) for the architecture and phased build plan.

## Status

Phase 1 (booking foundation) in progress:

- [x] Magic-link auth (better-auth)
- [x] Creator onboarding and public `/@handle` profile pages
- [x] Weekly availability rules with timezone-correct slot generation
- [x] Booking flow with database-enforced double-booking prevention
- [x] Stripe Checkout, webhooks, refunds (Connect payouts pending)
- [ ] Confirmation and reminder emails
- [ ] Timed video calls (LiveKit) and settlement
- [ ] Instant calls

## Stack

Next.js (App Router) · TypeScript · Postgres · Drizzle ORM · better-auth ·
Tailwind. Planned: Stripe Connect, LiveKit, Resend, pg-boss.

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
