import { formatPrice, formatTimeRange } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/queries";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-charcoal">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-charcoal/60">{sub}</p>}
    </div>
  );
}

export function SummaryStrip({ data }: { data: AdminDashboardData }) {
  const confirmed = data.bookings.filter((b) => b.status === "confirmed").length;
  const occ = data.bookableSlots > 0 ? Math.round((data.occupiedSlots / data.bookableSlots) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat label="Bookings today" value={String(confirmed)} />
      <Stat label="Occupancy" value={`${occ}%`} sub={`${data.occupiedSlots}/${data.bookableSlots} slots`} />
      <Stat label="Revenue today" value={formatPrice(data.revenueCents)} />
      <Stat
        label="Next booking"
        value={data.nextBooking ? formatTimeRange(data.nextBooking.startsAt, data.nextBooking.endsAt) : "—"}
        sub={data.nextBooking?.courtName}
      />
    </div>
  );
}
