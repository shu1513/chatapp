export const metadata = { title: "Refund Policy — chatapp" };

export default function RefundsPage() {
  return (
    <>
      <h1>Refund Policy</h1>
      <p>Last updated: July 10, 2026</p>

      <h2>Scheduled calls</h2>
      <ul>
        <li>
          Cancel <strong>more than 24 hours</strong> before the call: full
          automatic refund.
        </li>
        <li>
          Cancel <strong>within 24 hours</strong> of the call: no refund — the
          creator reserved that time for you.
        </li>
        <li>
          The creator cancels or doesn&apos;t show up: full automatic refund,
          no action needed.
        </li>
        <li>
          You don&apos;t show up: the creator keeps the payment.
        </li>
      </ul>

      <h2>Instant calls</h2>
      <ul>
        <li>
          When you request an instant call we place a hold for the maximum
          call length. You are only charged for minutes actually spent
          connected, rounded up to the next minute; the rest of the hold is
          released.
        </li>
        <li>
          If the creator declines or doesn&apos;t answer, the hold is released
          in full — you pay nothing.
        </li>
      </ul>

      <h2>Technical failures</h2>
      <p>
        Billable time only counts while both participants are connected, so
        disconnections stop the clock automatically. If something still goes
        wrong, email shuyangdev@gmail.com within 48 hours and we&apos;ll make
        it right.
      </p>
    </>
  );
}
