import { formatPrice, formatTimeRange } from "@/lib/utils";
import { groupBookings, type AdminBooking } from "@/lib/admin/queries";

/** Read-only list of the day's bookings, one row per booking group (Plan §10.1). */
export function BookingList({ bookings }: { bookings: AdminBooking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-card border border-surface bg-white p-10 text-center shadow-soft">
        <p className="font-semibold text-charcoal">No bookings for this day</p>
        <p className="mt-1 text-sm text-charcoal/60">New bookings appear here automatically.</p>
      </div>
    );
  }

  const groups = groupBookings(bookings);

  return (
    <div className="overflow-hidden rounded-card border border-surface bg-white shadow-soft">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-surface bg-surface/40 text-xs uppercase tracking-wide text-charcoal/60">
          <tr>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Court</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface">
          {groups.map((g) => (
            <tr key={g.key} className="hover:bg-surface/30">
              <td className="px-4 py-3 font-medium text-charcoal">
                {g.items.map((b) => (
                  <span key={b.id} className="block">
                    {formatTimeRange(b.startsAt, b.endsAt)}
                  </span>
                ))}
              </td>
              <td className="px-4 py-3 text-charcoal/80">{g.courtNames.join(", ")}</td>
              <td className="px-4 py-3 text-charcoal/80">{g.lead.guestName}</td>
              <td className="px-4 py-3 text-charcoal/80">{formatPrice(g.totalPriceCents)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600">
                  Confirmed
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
