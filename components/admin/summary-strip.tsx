import { CalendarCheck, Clock, LayoutGrid } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { AdminBooking } from "@/lib/admin/queries";

/** The essentials at a glance (Plan §10.1): bookings today, occupancy, next up. */
export function SummaryStrip({
  bookings,
  courtCount,
}: {
  bookings: AdminBooking[];
  courtCount: number;
}) {
  const occupied = new Set(bookings.map((b) => b.courtName)).size;
  const free = Math.max(courtCount - occupied, 0);

  const now = Date.now();
  const next = bookings
    .filter((b) => new Date(b.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card icon={<CalendarCheck size={18} />} label="Bookings">
        <span className="text-2xl font-bold text-charcoal">{bookings.length}</span>
      </Card>
      <Card icon={<LayoutGrid size={18} />} label="Courts occupied / free">
        <span className="text-2xl font-bold text-charcoal">
          {occupied} <span className="text-charcoal/40">/ {free}</span>
        </span>
      </Card>
      <Card icon={<Clock size={18} />} label="Next booking">
        {next ? (
          <span className="text-base font-semibold text-charcoal">
            {formatTime(next.startsAt)} · {next.courtName}
          </span>
        ) : (
          <span className="text-base font-medium text-charcoal/50">None upcoming</span>
        )}
      </Card>
    </div>
  );
}

function Card({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-charcoal/50">
        <span className="text-green-600">{icon}</span>
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
