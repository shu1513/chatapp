import { describe, expect, it } from "vitest";
import { bothPresentSeconds, type PresenceEvent } from "./overlap";

const t = (sec: number) => new Date(2026, 0, 1, 12, 0, sec);
const j = (identity: string, sec: number): PresenceEvent => ({
  type: "participant_joined",
  identity,
  at: t(sec),
});
const l = (identity: string, sec: number): PresenceEvent => ({
  type: "participant_left",
  identity,
  at: t(sec),
});

describe("bothPresentSeconds", () => {
  it("zero when only one participant ever joins", () => {
    expect(bothPresentSeconds([j("a", 0)], "a", "b", t(600))).toBe(0);
  });

  it("simple overlap: both join, both leave", () => {
    const events = [j("a", 0), j("b", 30), l("a", 90), l("b", 120)];
    expect(bothPresentSeconds(events, "a", "b", t(600))).toBe(60); // 30..90
  });

  it("extends to `until` when both still present", () => {
    const events = [j("a", 0), j("b", 60)];
    expect(bothPresentSeconds(events, "a", "b", t(600))).toBe(540); // 60..600
  });

  it("sums multiple overlap windows across a reconnect", () => {
    const events = [
      j("a", 0),
      j("b", 0),
      l("b", 100), // b drops
      j("b", 160), // b back after 60s
      l("a", 300),
      l("b", 300),
    ];
    // 0..100 = 100, 160..300 = 140
    expect(bothPresentSeconds(events, "a", "b", t(600))).toBe(240);
  });

  it("ignores other identities", () => {
    const events = [j("a", 0), j("intruder", 5), j("b", 10), l("b", 70)];
    expect(bothPresentSeconds(events, "a", "b", t(600))).toBe(60);
  });

  it("ignores events after `until`", () => {
    const events = [j("a", 0), j("b", 0), l("a", 900)];
    expect(bothPresentSeconds(events, "a", "b", t(600))).toBe(600);
  });

  it("handles duplicate join events idempotently", () => {
    const events = [j("a", 0), j("a", 10), j("b", 20), l("a", 80)];
    expect(bothPresentSeconds(events, "a", "b", t(600))).toBe(60);
  });
});
