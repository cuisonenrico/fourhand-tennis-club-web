import { describe, expect, it } from "vitest";
import { buildRowSegments } from "./schedule";
import type { ScheduleCell } from "./queries";

type Status = ScheduleCell["status"];

const cell = (
  startsAt: string,
  endsAt: string,
  status: Status,
  opts: Partial<ScheduleCell> = {},
): ScheduleCell => ({
  startsAt,
  endsAt,
  status,
  guestName: null,
  guestEmail: null,
  guestPhone: null,
  bookingGroupId: null,
  ...opts,
});

/** Build the ordered hour list + lookup map the grid hands to buildRowSegments. */
function rowFrom(cells: ScheduleCell[]) {
  return {
    hours: cells.map((c) => c.startsAt),
    map: new Map(cells.map((c) => [c.startsAt, c])),
  };
}

describe("buildRowSegments", () => {
  it("merges consecutive booked cells sharing a booking group", () => {
    const cells = [
      cell("10:00", "11:00", "booked", { bookingGroupId: "g1", guestName: "Ann" }),
      cell("11:00", "12:00", "booked", { bookingGroupId: "g1", guestName: "Ann" }),
      cell("12:00", "13:00", "booked", { bookingGroupId: "g1", guestName: "Ann" }),
    ];
    const { hours, map } = rowFrom(cells);
    const segs = buildRowSegments(hours, map);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: "booked", span: 3, startsAt: "10:00", endsAt: "13:00" });
  });

  it("does not merge adjacent bookings from different groups", () => {
    const cells = [
      cell("10:00", "11:00", "booked", { bookingGroupId: "g1", guestName: "Ann" }),
      cell("11:00", "12:00", "booked", { bookingGroupId: "g2", guestName: "Bea" }),
    ];
    const { hours, map } = rowFrom(cells);
    const segs = buildRowSegments(hours, map);
    expect(segs.map((s) => s.kind)).toEqual(["booked", "booked"]);
    expect(segs).toHaveLength(2);
  });

  it("breaks a run when a non-booked cell interrupts it", () => {
    const cells = [
      cell("10:00", "11:00", "booked", { bookingGroupId: "g1" }),
      cell("11:00", "12:00", "free"),
      cell("12:00", "13:00", "booked", { bookingGroupId: "g1" }),
    ];
    const { hours, map } = rowFrom(cells);
    const segs = buildRowSegments(hours, map);
    expect(segs.map((s) => s.kind)).toEqual(["booked", "single", "booked"]);
    expect(segs[0]).toMatchObject({ span: 1 });
    expect(segs[2]).toMatchObject({ span: 1 });
  });

  it("falls back to guest name when there is no group id", () => {
    const cells = [
      cell("10:00", "11:00", "booked", { guestName: "Ann" }),
      cell("11:00", "12:00", "booked", { guestName: "Ann" }),
      cell("12:00", "13:00", "booked", { guestName: "Bea" }),
    ];
    const { hours, map } = rowFrom(cells);
    const segs = buildRowSegments(hours, map);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ span: 2, guestName: "Ann" });
    expect(segs[1]).toMatchObject({ span: 1, guestName: "Bea" });
  });

  it("emits empty segments for hours with no slot", () => {
    const cells = [cell("10:00", "11:00", "booked", { bookingGroupId: "g1" })];
    // 11:00 has no cell in the map but is a column in the row.
    const hours = ["10:00", "11:00"];
    const map = new Map(cells.map((c) => [c.startsAt, c]));
    const segs = buildRowSegments(hours, map);
    expect(segs.map((s) => s.kind)).toEqual(["booked", "empty"]);
  });

  it("carries contact details from the lead cell of a run", () => {
    const cells = [
      cell("10:00", "11:00", "booked", {
        bookingGroupId: "g1",
        guestName: "Ann",
        guestEmail: "ann@example.com",
        guestPhone: "+63 900",
      }),
      cell("11:00", "12:00", "booked", { bookingGroupId: "g1", guestName: "Ann" }),
    ];
    const { hours, map } = rowFrom(cells);
    const [seg] = buildRowSegments(hours, map);
    expect(seg).toMatchObject({
      kind: "booked",
      guestEmail: "ann@example.com",
      guestPhone: "+63 900",
    });
  });
});
