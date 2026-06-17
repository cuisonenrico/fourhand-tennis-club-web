import { describe, expect, it } from "vitest";
import { summariseRevenue } from "./queries";
import type { AdminBooking } from "./queries";

const b = (priceCents: number, startsAt: string): AdminBooking => ({
  id: crypto.randomUUID(), guestName: "X", status: "confirmed", priceCents,
  courtName: "C1", startsAt, endsAt: startsAt,
});

describe("summariseRevenue", () => {
  it("sums confirmed booking prices", () => {
    expect(summariseRevenue([b(50000, "2026-07-01T10:00:00Z"), b(70000, "2026-07-01T11:00:00Z")])).toBe(120000);
  });
  it("is zero for no bookings", () => {
    expect(summariseRevenue([])).toBe(0);
  });
});
