import { describe, expect, it } from "vitest";
import { summariseRevenue, groupBookings } from "./queries";
import type { AdminBooking } from "./queries";

const b = (
  priceCents: number,
  startsAt: string,
  bookingGroupId: string | null = null,
  id: string = crypto.randomUUID(),
): AdminBooking => ({
  id, guestName: "X", status: "confirmed", priceCents,
  courtName: "C1", startsAt, endsAt: startsAt, bookingGroupId,
});

describe("summariseRevenue", () => {
  it("sums confirmed booking prices", () => {
    expect(summariseRevenue([b(50000, "2026-07-01T10:00:00Z"), b(70000, "2026-07-01T11:00:00Z")])).toBe(120000);
  });
  it("is zero for no bookings", () => {
    expect(summariseRevenue([])).toBe(0);
  });
});

describe("groupBookings", () => {
  it("collapses rows sharing a group id and sums their prices", () => {
    const groups = groupBookings([
      b(50000, "2026-07-01T10:00:00Z", "g1"),
      b(50000, "2026-07-01T11:00:00Z", "g1"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalPriceCents).toBe(100000);
    expect(groups[0].items).toHaveLength(2);
  });

  it("sorts members by start time and uses the earliest as lead", () => {
    const groups = groupBookings([
      b(50000, "2026-07-01T11:00:00Z", "g1", "late"),
      b(50000, "2026-07-01T10:00:00Z", "g1", "early"),
    ]);
    expect(groups[0].lead.id).toBe("early");
    expect(groups[0].items.map((i) => i.id)).toEqual(["early", "late"]);
  });

  it("keeps ungrouped rows separate, keyed by booking id", () => {
    const groups = groupBookings([
      b(50000, "2026-07-01T10:00:00Z", null, "a"),
      b(70000, "2026-07-01T11:00:00Z", null, "b"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.key)).toEqual(["a", "b"]);
  });

  it("preserves the order groups first appear", () => {
    const groups = groupBookings([
      b(50000, "2026-07-01T10:00:00Z", "g2"),
      b(50000, "2026-07-01T11:00:00Z", "g1"),
      b(50000, "2026-07-01T12:00:00Z", "g2"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["g2", "g1"]);
  });

  it("collects distinct court names", () => {
    const groups = groupBookings([
      { ...b(50000, "2026-07-01T10:00:00Z", "g1"), courtName: "C1" },
      { ...b(50000, "2026-07-01T11:00:00Z", "g1"), courtName: "C1" },
    ]);
    expect(groups[0].courtNames).toEqual(["C1"]);
  });
});
