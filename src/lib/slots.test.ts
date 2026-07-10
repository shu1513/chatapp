import { describe, expect, it } from "vitest";
import { generateSlots } from "./slots";

// Wed 2026-07-01 00:00:00 UTC
const NOW = new Date("2026-07-01T00:00:00Z");

const base = {
  timezone: "America/Los_Angeles",
  callLengthMin: 15,
  now: NOW,
  horizonDays: 13,
  minNoticeMin: 60,
  busy: [] as { start: Date; end: Date }[],
};

describe("generateSlots", () => {
  it("returns empty for no rules", () => {
    expect(generateSlots({ ...base, rules: [] })).toEqual([]);
  });

  it("generates slots for a weekly window in the creator's timezone", () => {
    // Monday 9:00-10:00 PT. July 2026: PDT (UTC-7), so 9:00 local = 16:00 UTC.
    const slots = generateSlots({
      ...base,
      rules: [{ weekday: 1, startMinute: 540, endMinute: 600 }],
    });
    // Mondays in horizon (Jul 1 + 13 days): Jul 6, Jul 13 -> 4 slots each
    expect(slots).toHaveLength(8);
    expect(slots[0].start.toISOString()).toBe("2026-07-06T16:00:00.000Z");
    expect(slots[0].end.toISOString()).toBe("2026-07-06T16:15:00.000Z");
    expect(slots[3].start.toISOString()).toBe("2026-07-06T16:45:00.000Z");
    expect(slots[4].start.toISOString()).toBe("2026-07-13T16:00:00.000Z");
  });

  it("respects minimum notice", () => {
    // Rule matching "today" with a start already past
    const slots = generateSlots({
      ...base,
      timezone: "UTC",
      // Wednesday 00:00-01:00 UTC — same window as `now`
      rules: [{ weekday: 3, startMinute: 0, endMinute: 60 }],
      minNoticeMin: 30,
    });
    // Slots at 00:00 and 00:15 are within notice; 00:30 and 00:45 survive
    const today = slots.filter(
      (s) => s.start.toISOString().slice(0, 10) === "2026-07-01",
    );
    expect(today.map((s) => s.start.toISOString())).toEqual([
      "2026-07-01T00:30:00.000Z",
      "2026-07-01T00:45:00.000Z",
    ]);
  });

  it("excludes slots overlapping busy intervals", () => {
    const slots = generateSlots({
      ...base,
      rules: [{ weekday: 1, startMinute: 540, endMinute: 600 }],
      busy: [
        {
          // covers the 16:15 and 16:30 slots on Jul 6
          start: new Date("2026-07-06T16:20:00Z"),
          end: new Date("2026-07-06T16:40:00Z"),
        },
      ],
    });
    const jul6 = slots.filter(
      (s) => s.start.toISOString().slice(0, 10) === "2026-07-06",
    );
    expect(jul6.map((s) => s.start.toISOString())).toEqual([
      "2026-07-06T16:00:00.000Z",
      "2026-07-06T16:45:00.000Z",
    ]);
  });

  it("handles timezones across the UTC date line", () => {
    // Tuesday 9:00 in Auckland (UTC+12 in July) = Monday 21:00 UTC
    const slots = generateSlots({
      ...base,
      timezone: "Pacific/Auckland",
      rules: [{ weekday: 2, startMinute: 540, endMinute: 555 }],
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].start.toISOString()).toBe("2026-07-06T21:00:00.000Z");
    expect(slots[0].start.getUTCDay()).toBe(1); // Monday UTC, Tuesday local
  });

  it("stays monotonic and non-overlapping across a DST fall-back day", () => {
    // US DST ends Sun Nov 1 2026 (2:00 -> 1:00). Window 0:00-4:00 local.
    const slots = generateSlots({
      ...base,
      now: new Date("2026-10-28T00:00:00Z"),
      timezone: "America/New_York",
      callLengthMin: 60,
      rules: [{ weekday: 0, startMinute: 0, endMinute: 240 }],
      horizonDays: 6,
      busy: [],
    });
    expect(slots.length).toBeGreaterThan(0);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].start.getTime()).toBeGreaterThanOrEqual(
        slots[i - 1].end.getTime() - 1,
      );
    }
    for (const s of slots) {
      expect(s.end.getTime()).toBeGreaterThan(s.start.getTime());
    }
  });

  it("skips blacked-out local dates", () => {
    const slots = generateSlots({
      ...base,
      rules: [{ weekday: 1, startMinute: 540, endMinute: 600 }],
      blackoutDates: new Set(["2026-07-06"]),
    });
    // Jul 6 gone, Jul 13 remains
    expect(slots).toHaveLength(4);
    expect(slots[0].start.toISOString()).toBe("2026-07-13T16:00:00.000Z");
  });

  it("applies buffer between generated slots", () => {
    // 9:00-10:00, 15-min calls, 5-min buffer -> 9:00, 9:20, 9:40
    const slots = generateSlots({
      ...base,
      rules: [{ weekday: 1, startMinute: 540, endMinute: 600 }],
      bufferMin: 5,
    });
    const jul6 = slots.filter(
      (s) => s.start.toISOString().slice(0, 10) === "2026-07-06",
    );
    expect(jul6.map((s) => s.start.toISOString())).toEqual([
      "2026-07-06T16:00:00.000Z",
      "2026-07-06T16:20:00.000Z",
      "2026-07-06T16:40:00.000Z",
    ]);
  });

  it("keeps buffer distance from existing bookings", () => {
    // Booking at 16:20-16:35 with 5-min buffer. 16:00 slot survives: it
    // ends 16:15, leaving exactly the 5-min gap before the booking.
    // 16:20 slot dies (overlaps the booking). 16:40 slot survives: it
    // starts exactly 5 min after the booking ends.
    const slots = generateSlots({
      ...base,
      rules: [{ weekday: 1, startMinute: 540, endMinute: 600 }],
      bufferMin: 5,
      busy: [
        {
          start: new Date("2026-07-06T16:20:00Z"),
          end: new Date("2026-07-06T16:35:00Z"),
        },
      ],
    });
    const jul6 = slots.filter(
      (s) => s.start.toISOString().slice(0, 10) === "2026-07-06",
    );
    expect(jul6.map((s) => s.start.toISOString())).toEqual([
      "2026-07-06T16:00:00.000Z",
      "2026-07-06T16:40:00.000Z",
    ]);
  });

  it("drops zero-length artifacts on spring-forward day", () => {
    // US DST starts Sun Mar 8 2026, 2:00 -> 3:00 local (2:xx doesn't exist)
    const slots = generateSlots({
      ...base,
      now: new Date("2026-03-04T00:00:00Z"),
      timezone: "America/New_York",
      callLengthMin: 60,
      rules: [{ weekday: 0, startMinute: 60, endMinute: 240 }], // 1:00-4:00
      horizonDays: 6,
      busy: [],
    });
    for (const s of slots) {
      expect(s.end.getTime()).toBeGreaterThan(s.start.getTime());
    }
  });
});
