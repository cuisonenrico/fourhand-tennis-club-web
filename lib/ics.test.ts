import { describe, it, expect } from "vitest";
import { buildBookingIcs } from "@/lib/ics";

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
