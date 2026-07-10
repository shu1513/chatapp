import { describe, expect, it } from "vitest";
import { instantCaptureCents } from "./instant-billing";

// $2/min, 30-min block = $60 auth
const base = { maxBlockPriceCents: 6000, maxBlockMin: 30 };

describe("instantCaptureCents", () => {
  it("zero billable captures nothing", () => {
    expect(instantCaptureCents({ ...base, billableSeconds: 0 })).toBe(0);
  });

  it("rounds partial minutes up", () => {
    // 61s -> 2 minutes -> $4
    expect(instantCaptureCents({ ...base, billableSeconds: 61 })).toBe(400);
  });

  it("exact minutes bill exactly", () => {
    expect(instantCaptureCents({ ...base, billableSeconds: 300 })).toBe(1000);
  });

  it("clamps to the authorized block", () => {
    // 45 min of billable time can't exceed the 30-min auth
    expect(instantCaptureCents({ ...base, billableSeconds: 2700 })).toBe(6000);
  });

  it("one second bills one minute", () => {
    expect(instantCaptureCents({ ...base, billableSeconds: 1 })).toBe(200);
  });
});
