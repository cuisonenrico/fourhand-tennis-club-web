import type { ScheduleCell } from "@/lib/admin/queries";

/**
 * A horizontal run within a court row. Consecutive booked cells of the same
 * booking group (fallback: same guest name) collapse into one `booked` segment
 * spanning those hours; everything else stays one cell wide.
 */
export type RowSegment =
  | {
      kind: "booked";
      span: number;
      startsAt: string;
      endsAt: string;
      guestName: string | null;
      guestEmail: string | null;
      guestPhone: string | null;
    }
  | { kind: "single"; cell: ScheduleCell }
  | { kind: "empty" };

/** Key that decides whether two booked cells belong to the same block. */
function bookedKey(cell: ScheduleCell): string {
  return cell.bookingGroupId ?? cell.guestName ?? cell.startsAt;
}

/**
 * Walk the ordered hour columns for one court, merging adjacent booked cells
 * that share a booking key into a single spanning segment.
 */
export function buildRowSegments(
  hours: string[],
  cellMap: Map<string, ScheduleCell>,
): RowSegment[] {
  const segs: RowSegment[] = [];
  let i = 0;
  while (i < hours.length) {
    const cell = cellMap.get(hours[i]);
    if (!cell) {
      segs.push({ kind: "empty" });
      i++;
      continue;
    }
    if (cell.status !== "booked") {
      segs.push({ kind: "single", cell });
      i++;
      continue;
    }
    const key = bookedKey(cell);
    let j = i + 1;
    let last = cell;
    while (j < hours.length) {
      const next = cellMap.get(hours[j]);
      if (!next || next.status !== "booked" || bookedKey(next) !== key) break;
      last = next;
      j++;
    }
    segs.push({
      kind: "booked",
      span: j - i,
      startsAt: cell.startsAt,
      endsAt: last.endsAt,
      guestName: cell.guestName,
      guestEmail: cell.guestEmail,
      guestPhone: cell.guestPhone,
    });
    i = j;
  }
  return segs;
}
