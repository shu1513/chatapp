export const metadata = { title: "Terms of Service — chatapp" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: July 10, 2026</p>
      <p>
        chatapp is a marketplace where creators offer paid one-on-one video
        calls to their audience. By using chatapp you agree to these terms.
      </p>

      <h2>The service</h2>
      <ul>
        <li>
          Creators list availability and rates; customers book scheduled calls
          or request instant calls. Payment is processed by Stripe.
        </li>
        <li>
          Scheduled calls are charged up front. Instant calls place a hold for
          the maximum call length and charge only for minutes used, rounded up
          to the next minute.
        </li>
        <li>
          Call time is measured server-side as the time both participants are
          connected. Calls end automatically when the booked time is up.
        </li>
      </ul>

      <h2>Strictly non-sexual content</h2>
      <p>
        chatapp is for conversation: fan meet-and-greets, advice, mentorship,
        coaching, and hanging out. Sexual content or services of any kind are
        prohibited — including nudity, sexually explicit conduct or
        solicitation, and offering or requesting sexual services. One violation
        ends the account. All users must be 18 or older.
      </p>

      <h2>Conduct</h2>
      <ul>
        <li>No harassment, hate, threats, or recording without consent.</li>
        <li>
          No steering payment off the platform. Calls arranged on chatapp are
          paid on chatapp.
        </li>
        <li>
          Impersonating another person is prohibited and grounds for immediate
          removal.
        </li>
      </ul>

      <h2>Cancellations, no-shows, and refunds</h2>
      <p>See our Refund Policy for the full rules. In short:</p>
      <ul>
        <li>Cancel more than 24 hours before a call: full refund.</li>
        <li>Cancel within 24 hours: no refund.</li>
        <li>Creator no-show: automatic full refund.</li>
        <li>Customer no-show: the creator keeps the payment.</li>
      </ul>

      <h2>Payments to creators</h2>
      <p>
        Creators receive their share of each completed call via Stripe
        Connect, after a short escrow window. chatapp retains a platform fee
        disclosed at onboarding.
      </p>

      <h2>Enforcement and disputes</h2>
      <p>
        We review reports and may suspend accounts that violate these terms.
        We keep connection metadata (join and leave times, call duration) to
        resolve billing disputes; calls are not recorded.
      </p>

      <h2>Liability</h2>
      <p>
        chatapp provides the platform &quot;as is&quot; and is not a party to
        the conversation between creators and customers. To the maximum extent
        permitted by law, our liability is limited to the amount you paid for
        the booking in question.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: shuyangdev@gmail.com</p>
    </>
  );
}
