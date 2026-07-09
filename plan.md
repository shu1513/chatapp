# Implementation Plan — Paid 1:1 Creator Video Call Marketplace

Fans pay to video chat with their favorite influencers. Creators list availability on a
calendar (reserve + approve flow) or take instant calls when online. Time is tracked
server-side and charged for.

Working name: TBD. Directory: this repo.

---

## 1. Product summary

- **Creator (Host)**: verified influencer. Sets per-call rate (flat price for scheduled
  slots, per-minute for instant calls), call lengths, availability. Gets a public page
  `yourapp.com/@handle` to drop in their link-in-bio.
- **Customer (Fan)**: books a slot (request → creator accepts/denies, or auto-accept),
  or calls instantly when the creator is live.
- **Platform**: takes a percentage fee per call (benchmark: Popcall 20%, Superpeer 15%).

Key product insight: fans arrive already knowing which creator they want. Distribution
comes from creators' own audiences (link-in-bio), not from a browse directory. Build the
creator page first; discovery/marketplace browsing comes much later.

Competitive slot: calendar-first + instant hybrid for mid-tier influencers (10k–500k
followers) — too small for Cameo, big enough to sell out slots. Nobody owns this today.

---

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Video | LiveKit Cloud | Backend-controlled rooms (create/kick/timeout), webhooks, short-TTL join tokens, open-source self-host escape hatch |
| Payments | Stripe Connect (Express accounts) using **separate charges & transfers** | Charge lands on platform account; transfer to creator fired separately after the call → natural escrow/dispute window. Destination charges transfer immediately — wrong fit |
| Scheduled billing | Charge full amount at booking/accept; refund per policy | Avoids the ~7-day card authorization window problem entirely. Fans expect pay-upfront (Cameo model) |
| Instant billing | Auth hold for max block (`capture_method=manual`) at call start; capture actual minutes at end; overtime = separate top-up PaymentIntent | Same-day capture → hold window is a non-issue. One capture per PI; partial capture releases remainder — hence top-ups, never one giant open auth |
| Payout | Transfer to creator T+24h after call completes with no dispute | Escrow window protects vs. no-show fraud and chargebacks |
| Calendar | Own Postgres booking engine. No Nylas/Cal.com | Rules are marketplace-specific (approval, holds, no-show fees, timers). Google Calendar sync = later enhancement via direct OAuth |
| Call timer | Server-side authoritative. Billable time = overlap when **both** participants connected. 60s reconnect grace. LiveKit webhooks + 30s polling reconciliation | Never trust the client. Webhooks are best-effort → reconcile |
| Dispute evidence | Metadata ledger (join/leave timestamps, IPs, durations), **no recording** | Privacy-friendly; metadata is usually sufficient for card disputes. Revisit if dispute rate demands (Popcall records everything — their tradeoff) |
| Stack | One Next.js monolith + Postgres, deployed on Railway/Render/Fly + managed PG | Websockets + webhooks + cron are awkward on serverless. One deployable = no over-engineering |
| Jobs | pg-boss (Postgres-backed) | No Redis/queue broker needed at this scale |
| Email | Resend (+ `.ics` attachments) | Reminders, receipts. Email is the reliable channel — see push caveat below |
| Realtime presence/ring | Pusher or Ably (rented, not built) | Phase 3 only |
| Category/positioning | Creator/fan engagement ("Cameo for live calls"). **No adult creators** — enforced at verification | Keeps mainstream processing. Adult content drags into high-risk acquiring (5–10% fees, rolling reserves, VIRP) |

### Payments/category risk (read this before writing payment code)

- Get **written Stripe pre-approval** describing the real business before building.
- If Stripe terminates for cause later, the business can be MATCH-listed (~5 years,
  checked by all mainstream acquirers: Adyen, Mangopay, Braintree). Moderation is
  therefore a launch dependency, not a v3 feature.
- Plan B if Stripe declines on paperwork (not category): Adyen for Platforms, Mangopay
  (wallet model, good escrow fit, EU-strong), Airwallex. All also prohibit adult content.
- Keep the Postgres ledger as the source of truth for money (not Stripe's dashboard) so
  an acquirer migration is survivable.
- Stripe Connect payouts cover ~46 countries (US/W.EU/AU fine; LatAm thin). Customers
  can be anywhere; creators must be in supported countries. Check current list.
- Sales tax: decide merchant-of-record posture day one; use Stripe Tax for EU VAT
  (OSS), UK VAT, AU GST.

### iOS push caveat

Web push on iOS requires home-screen PWA install, and EU iPhones lost PWA push entirely
(iOS 17.4 DMA change). Western Europe is a target market → scheduled-call UX must lean on
**email + one-tap join links**, with push as enhancement. Native mobile app (CallKit
ringing) is the real fix, later.

---

## 3. Explicitly NOT building in v1

Browse/discovery directory, per-minute scheduled calls, group calls, paid DMs, mobile
apps, SMS (A2P 10DLC registration takes weeks; poor global economics), reviews/ratings,
multi-vendor payment abstraction (thin module boundary only), recording, Google Calendar
sync, wallet credits, auctions/raffles.

---

## 4. Schema core

All times UTC (`timestamptz`). Append-only where noted.

```
users                    (id, email, role, stripe_customer_id, created_at)
creators                 (user_id, handle UNIQUE, display_name, bio, avatar,
                          rate_cents, call_length_min, approval_mode bool,
                          instant_rate_cents_per_min, verified_at,
                          stripe_account_id, status)
availability_rules       (creator_id, weekday, start_time, end_time, timezone)
availability_exceptions  (creator_id, date, kind)
slot_holds               (creator_id, slot tstzrange, expires_at)          -- TTL rows
bookings                 (id, creator_id, customer_id, slot tstzrange, status,
                          price_cents, payment_intent_id, room_name,
                          EXCLUDE USING gist (creator_id WITH =, slot WITH &&))
call_sessions            (id, booking_id NULL, kind scheduled|instant, state,
                          billable_seconds, started_at, ended_at, flags)
session_events           (session_id, type, participant, at, source)       -- append-only
instant_call_requests    (id, creator_id, customer_id, state, expires_at,
                          auth_payment_intent_id)
webhook_events           (provider, event_id UNIQUE, payload, processed_at) -- idempotency
ledger_entries           (id, type, booking_id/session_id, amount_cents,
                          stripe_ref, created_at)                           -- append-only
payouts                  (creator_id, amount_cents, transfer_id, status, at)
notification_subscriptions (user_id, kind, endpoint/token)
reports                  (session_id, reporter_id, reason, status)
disputes                 (stripe_dispute_id, booking_id, status, evidence)
```

Booking status: `pending_approval → confirmed → completed | declined | cancelled |
refunded | no_show_customer | no_show_creator`.

Slot conflicts: `btree_gist` exclusion constraint (above) + short-lived `slot_holds`
during checkout. Race-proof by the database, not the app.

---

## 5. Phases

### Phase 0 — Unblock (week 1, parallel with Phase 1)

1. Stripe pre-approval in writing. Honest description: "marketplace for paid live 1:1
   video calls between creators/influencers and fans, non-adult, moderated."
2. Policy docs: ToS (no sexual content/services, 18+, no off-platform payment steering,
   one-strike removal), privacy policy, refund/cancellation policy.
3. Entity + Stripe platform account.

**Exit: Stripe yes on paper. If no → stop, reassess (Adyen/Mangopay path).**

### Phase 1 — Creator page + booking, no video yet (weeks 1–3)

1. Auth: email magic link (Auth.js or Lucia).
2. Creator onboarding: handle, rate, call lengths, availability rules → Stripe Connect
   Express onboarding → verification: Stripe Identity + social-account proof
   (code-in-bio check or OAuth link to IG/TikTok/YT). Manual admin approval at launch
   scale. Impersonation is the top fraud vector — this gate is mandatory.
3. Public `/@handle` page: profile, computed available slots (rules − exceptions −
   bookings), book button. This page is the product — creators must be proud to link it.
4. Booking flow: pick slot → `slot_hold` → Stripe Checkout/Elements → charge on platform
   account → `confirmed` (auto-accept default). Approval mode: save card at request,
   charge on accept, nothing charged on decline. Pending requests auto-expire (24h TTL).
5. Emails via Resend: confirmations both sides + `.ics`; reminders T-24h/T-1h (pg-boss).
6. Cancellation: customer → refund per policy window; creator → always full refund.

**Exit: real money moves. Book, charge, decline-refund, cancel-refund all work.
Double-booking impossible under concurrent load test.**

### Phase 2 — Timed video call + settlement (weeks 3–6) — the core

1. Room lifecycle: pg-boss job at T-10min creates LiveKit room (`emptyTimeout`,
   `maxParticipants: 2`). Join page mints short-TTL token (identity = user id, grant
   scoped to that room). Lobby with camera preview from T-10min.
2. `call_sessions` state machine, server-side, driven by webhooks + poller:

   ```
   scheduled → lobby → active          (both participants connected)
   active    → grace                   (one side dropped; 60s timer)
   grace     → active                  (reconnected)
   grace|active → ended                (grace expired / time up / both left)
   ```

3. Event ingestion: LiveKit webhook endpoint → verify signature → insert into
   `webhook_events` (dedupe on event id) → advance state machine. Note: LiveKit
   `participant_joined` fires on signal join, not media-active — billing trigger is
   "both present in room" by deliberate choice (a fan's broken webcam shouldn't cost
   the creator their fee).
4. Reconciler: while any session is live, poll `ListParticipants` every 30s. On
   `room_finished`, cross-check computed billable seconds vs room duration. Mismatch
   >10% → flag `needs_review`, do not auto-settle.
5. Timer mechanics: in-call countdown is display-only; server is authoritative. T-2min
   warning banner. Time up → 30s notice → `removeParticipant` both, delete room.
   Hard enforcement matters: creators run back-to-back slots; overruns cascade.
6. Extend: next slot free → customer sees "extend 10 min for $X" → new PaymentIntent,
   immediate capture → server extends session end.
7. Settlement on `ended`: write ledger rows → schedule T+24h `transfers.create` to
   creator (price − platform fee) → receipts. No-shows: customer absent full slot →
   creator still paid (stated policy); creator absent → auto full refund + strike.
8. Creator dashboard v0: upcoming calls, earnings, payout history.

**Exit: 20+ end-to-end test calls including kill-network-mid-call, both-no-show,
dropped-webhook (reconciler catches), refund, extend. Ledger reconciles to Stripe
dashboard to the cent.**

### Phase 3 — Instant calls (weeks 6–8)

1. Presence: creator toggles "available now"; heartbeat; Pusher/Ably channel.
2. Fan sees live badge on `/@handle` → "Call now, $X/min" → card auth for max block
   (e.g. 30 min × rate, `capture_method=manual`).
3. `instant_call_requests` row, 60s expiry → creator rings: in-app modal + sound (page
   open) + web push (if subscribed). Timeout/decline → release auth instantly.
4. Accept → create room → both auto-join → same state machine in per-minute mode →
   end → capture actual (round up to minute), remainder auto-released. Overtime past
   the block → mid-call top-up PI or hard stop.
5. Guardrails: creator in a call is not callable; auto-offline on heartbeat loss;
   per-fan rate limiting.

**Exit: ring → talk → capture correct, including abandoned auths released.**

### Phase 4 — Harden + grow (week 8+, order driven by demand)

- Trust & safety: in-call report button, admin review queue, strikes/bans, block lists.
  Pull earlier if creators onboard early.
- Dispute handling: Stripe dispute webhook → freeze payout if pre-transfer → evidence
  pack auto-built from ledger/session_events.
- Drops: slots released at an announced time + waitlist. First growth feature for
  mid-tier creators (their calendars sell out in minutes; open calendars break).
- Group calls (1 creator → N fans, ticket split). Biggest revenue-per-hour unlock;
  LiveKit supports natively. (Cameo Live model.)
- Reviews, discovery directory, paid DMs, Google Calendar sync.
- Native mobile apps: APNs/FCM + CallKit/Telecom for true phone-call ringing.
- Revisit take rate vs Popcall 20% / Superpeer 15% once volume exists.

---

## 6. Why this is not over-engineered

One deployable, one database, no queue brokers, no microservices. Postgres does jobs
(pg-boss), locking (exclusion constraints), and audit (append-only tables). Realtime is
rented (Pusher), not built. Vendor boundaries are thin modules (`lib/video.ts`,
`lib/payments.ts`) — swapping means rewriting one file, not maintaining an adapter
framework. Every phase ships user-visible value.

The only genuinely hard code is Phase 2's state machine + ledger — hard because the
money is real, not because the architecture is fancy. Biggest schedule risk is Phase 2
edge cases (reconnects, webhook gaps). Do not compress the test week.

---

## 7. Sources

- LiveKit: [room management](https://docs.livekit.io/home/server/managing-rooms/),
  [webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/),
  [webhook reliability](https://livekit.com/blog/managing-webhook-event-streams)
- Stripe: [charge types](https://docs.stripe.com/connect/charges),
  [destination charges](https://docs.stripe.com/connect/destination-charges),
  [application fees](https://docs.stripe.com/connect/marketplace/tasks/app-fees),
  [manual capture / holds](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method),
  [Connect overview](https://docs.stripe.com/connect)
- iOS push: [Apple web push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers),
  [iOS requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications),
  [PWA iOS limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- Market: [Popcall](https://popcall.com/),
  [Popcall billing](https://popcall.com/help/user/how-are-users-charged-for-video-calls),
  [Cameo Live](https://cameoblog.medium.com/introducing-cameo-live-10-minute-video-calls-with-your-favorite-stars-for-1-10-fans-ec8a00bf34af),
  [Superpeer](https://help.superpeer.com/en/articles/3922593-what-is-superpeer-and-how-does-it-work)
- Risk: [Mangopay prohibited businesses](https://mangopay.com/prohibited-businesses),
  [Visa VIRP](https://corepay.net/articles/visa-integrity-risk-program/),
  [MATCH / high-risk fees](https://bankcardinternationalgroup.com/visa-and-mastercard-high-risk-registration-fees-explained/)
