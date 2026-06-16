import { describe, it, expect } from "vitest";
import { buildBookingIcs, buildBookingIcsMulti } from "@/lib/ics";

describe("buildBookingIcs", () => {
  const ics = buildBookingIcs({
    courtName: "Court 1 — Centre",
    startsAt: "2026-07-01T02:00:00Z",
    endsAt: "2026-07-01T03:00:00Z",
    guestName: "Ana Cruz",
    location: "Fourhand Tennis Club, Manila",
  });

  it("produces a valid VEVENT", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("includes the court, location and confirmed status", () => {
    expect(ics).toContain("Court 1");
    // The ics spec escapes commas in text values (Manila → "Club\, Manila").
    expect(ics).toMatch(/LOCATION:Fourhand Tennis Club/);
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("encodes the UTC start time", () => {
    expect(ics).toMatch(/DTSTART:20260701T020000Z/);
  });
});

describe("buildBookingIcsMulti", () => {
  const ics = buildBookingIcsMulti({
    courtName: "Court 1 — Centre",
    guestName: "Ana Cruz",
    sessions: [
      { startsAt: "2026-07-01T02:00:00Z", endsAt: "2026-07-01T03:00:00Z" },
      { startsAt: "2026-07-01T03:00:00Z", endsAt: "2026-07-01T04:00:00Z" },
      { startsAt: "2026-07-01T04:00:00Z", endsAt: "2026-07-01T05:00:00Z" },
    ],
  });

  it("emits one VEVENT per booked hour", () => {
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(3);
  });

  it("encodes each consecutive start time", () => {
    expect(ics).toMatch(/DTSTART:20260701T020000Z/);
    expect(ics).toMatch(/DTSTART:20260701T030000Z/);
    expect(ics).toMatch(/DTSTART:20260701T040000Z/);
  });
});
