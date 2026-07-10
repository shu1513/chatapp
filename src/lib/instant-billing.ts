/**
 * Amount to capture for an instant call: billable time rounded up to the
 * minute at the per-minute rate, clamped to the authorized max block.
 * Zero billable time captures nothing (the auth should be cancelled).
 */
export function instantCaptureCents(opts: {
  maxBlockPriceCents: number;
  maxBlockMin: number;
  billableSeconds: number;
}): number {
  const { maxBlockPriceCents, maxBlockMin, billableSeconds } = opts;
  if (billableSeconds <= 0) return 0;
  const ratePerMin = maxBlockPriceCents / maxBlockMin;
  const billedMinutes = Math.ceil(billableSeconds / 60);
  return Math.min(
    maxBlockPriceCents,
    Math.round(billedMinutes * ratePerMin),
  );
}
