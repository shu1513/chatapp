export const metadata = { title: "Privacy Policy — chatapp" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: July 10, 2026</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account: email address, display name, timezone.</li>
        <li>
          Bookings and calls: booking times, prices, and connection metadata —
          when each participant joined and left, and total call duration.
        </li>
        <li>
          Payments: handled by Stripe. We never see or store full card
          numbers. We store Stripe identifiers needed to charge, refund, and
          pay out.
        </li>
      </ul>

      <h2>What we don&apos;t collect</h2>
      <p>
        Calls are not recorded. No audio, video, or transcripts are stored.
        Connection metadata (not content) is kept to resolve billing disputes.
      </p>

      <h2>How we use data</h2>
      <ul>
        <li>Operating bookings, calls, payments, and payouts.</li>
        <li>Transactional email: confirmations, reminders, sign-in links.</li>
        <li>Investigating reports of abuse and resolving disputes.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        Data goes to the processors that run the service — Stripe (payments),
        LiveKit (video infrastructure), Resend (email), and our hosting
        provider — and nowhere else, except as required by law. We do not sell
        personal data.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Booking and payment records are retained as required for tax and
        dispute purposes. To delete your account and remaining personal data,
        email shuyangdev@gmail.com.
      </p>

      <h2>Contact</h2>
      <p>Privacy questions: shuyangdev@gmail.com</p>
    </>
  );
}
