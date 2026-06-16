import { formatPrice, formatTimeRange } from "@/lib/utils";
import type { AdminBooking } from "@/lib/admin/queries";

/** Read-only list of the day's bookings (Plan §10.1). */
export function BookingList({ bookings }: { bookings: AdminBooking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-card border border-surface bg-white p-10 text-center shadow-soft">
        <p className="font-semibold text-charcoal">No bookings for this day</p>
        <p className="mt-1 text-sm text-charcoal/60">New bookings appear here automatically.</p>
      </div>
    );
  }

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
          {bookings.map((b) => (
            <tr key={b.id} className="hover:bg-surface/30">
              <td className="px-4 py-3 font-medium text-charcoal">{formatTimeRange(b.startsAt, b.endsAt)}</td>
              <td className="px-4 py-3 text-charcoal/80">{b.courtName}</td>
              <td className="px-4 py-3 text-charcoal/80">{b.guestName}</td>
              <td className="px-4 py-3 text-charcoal/80">{formatPrice(b.priceCents)}</td>
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
