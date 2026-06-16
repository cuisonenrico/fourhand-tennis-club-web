import { createEvent, type EventAttributes } from "ics";

export interface BookingIcsInput {
  courtName: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  guestName: string;
  location?: string;
}

/** Build a calendar invite (.ics) for a confirmed court booking. */
export function buildBookingIcs(input: BookingIcsInput): string {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);

  const event: EventAttributes = {
    title: `Tennis — ${input.courtName}`,
    description: `Court booking for ${input.guestName} at Fourhand Tennis Club.`,
    location: input.location ?? "Fourhand Tennis Club",
    start: toIcsArray(start),
    end: toIcsArray(end),
    startInputType: "utc",
    endInputType: "utc",
    productId: "fourhand-tennis-club/booking",
    status: "CONFIRMED",
    busyStatus: "BUSY",
  };

  const { error, value } = createEvent(event);
  if (error || !value) {
    throw new Error(`Failed to build .ics: ${error?.message ?? "unknown"}`);
  }
  return value;
}

/** ics expects [year, month, day, hour, minute] in the chosen input type (UTC). */
function toIcsArray(d: Date): [number, number, number, number, number] {
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}
