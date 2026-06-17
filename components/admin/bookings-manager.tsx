"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { AdminDateControl } from "@/components/admin/admin-date-control";
import { searchBookingsAction } from "@/lib/admin/actions";
import { formatTimeRange, formatPrice } from "@/lib/utils";
import type { AdminBookingDetail, BookingFilters } from "@/lib/admin/queries";
import type { Court } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: string }) {
  const label = source === "admin" ? "Admin" : source === "web" ? "Web" : source;
  const cls =
    source === "admin"
      ? "bg-blue-50 text-blue-600"
      : "bg-surface text-charcoal/70";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: "confirmed" | "cancelled" }) {
  return status === "confirmed" ? (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600">
      Confirmed
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-500">
      Cancelled
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  courts: Court[];
  initialBookings: AdminBookingDetail[];
  initialDateKey: string;
}

export function BookingsManager({ courts, initialBookings, initialDateKey }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey);
  const [courtId, setCourtId] = useState("");
  const [status, setStatus] = useState<"" | "confirmed" | "cancelled">("");
  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<AdminBookingDetail[]>(initialBookings);
  const [isPending, startTransition] = useTransition();

  type FilterOverrides = {
    dateKey?: string;
    courtId?: string;
    status?: "" | "confirmed" | "cancelled";
    q?: string;
  };

  function applyFilters(overrides: FilterOverrides = {}) {
    const nextStatus = overrides.status !== undefined ? overrides.status : status;

    const filters: BookingFilters = {
      ...(overrides.dateKey ?? dateKey ? { dateKey: overrides.dateKey ?? dateKey } : {}),
      ...(overrides.courtId !== undefined
        ? overrides.courtId
          ? { courtId: overrides.courtId }
          : {}
        : courtId
          ? { courtId }
          : {}),
      ...(nextStatus === "confirmed" || nextStatus === "cancelled"
        ? { status: nextStatus }
        : {}),
      ...(overrides.q !== undefined
        ? overrides.q
          ? { q: overrides.q }
          : {}
        : q
          ? { q }
          : {}),
    };

    startTransition(async () => {
      try {
        const results = await searchBookingsAction(filters);
        setBookings(results);
      } catch (err) {
        console.error("[BookingsManager] search failed:", err);
      }
    });
  }

  function handleDateChange(key: string) {
    setDateKey(key);
    applyFilters({ dateKey: key });
  }

  function handleCourtChange(val: string) {
    setCourtId(val);
    applyFilters({ courtId: val });
  }

  function handleStatusChange(val: "" | "confirmed" | "cancelled") {
    setStatus(val);
    applyFilters({ status: val });
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    applyFilters();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <h1 className="text-2xl font-bold text-charcoal">Bookings</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Date control */}
        <AdminDateControl value={dateKey} onChange={handleDateChange} />

        {/* Court select */}
        <select
          value={courtId}
          onChange={(e) => handleCourtChange(e.target.value)}
          className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
        >
          <option value="">All courts</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status select */}
        <select
          value={status}
          onChange={(e) =>
            handleStatusChange(e.target.value as "" | "confirmed" | "cancelled")
          }
          className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Search box */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40"
          />
          <input
            type="search"
            placeholder="Name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 w-full rounded-lg border border-surface bg-white pl-9 pr-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
          />
        </form>

        {/* Search button */}
        <button
          type="button"
          onClick={() => applyFilters()}
          disabled={isPending}
          className="h-10 rounded-lg bg-green px-4 text-sm font-medium text-white disabled:opacity-50 hover:bg-green/90"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results table */}
      {bookings.length === 0 ? (
        <div className="rounded-card border border-surface bg-white p-10 text-center shadow-soft">
          <p className="font-semibold text-charcoal">No bookings found</p>
          <p className="mt-1 text-sm text-charcoal/60">
            Try adjusting the date, court, or search query.
          </p>
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-card border border-surface bg-white shadow-soft transition-opacity ${isPending ? "opacity-50" : ""}`}
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface bg-surface/40 text-xs uppercase tracking-wide text-charcoal/60">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Court</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Email / Phone</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {/* Actions column reserved for Tasks 9–10 */}
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-surface/30">
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {formatTimeRange(b.startsAt, b.endsAt)}
                  </td>
                  <td className="px-4 py-3 text-charcoal/80">{b.courtName}</td>
                  <td className="px-4 py-3 text-charcoal/80">{b.guestName}</td>
                  <td className="px-4 py-3 text-charcoal/80">
                    <span className="block">{b.guestEmail}</span>
                    {b.guestPhone && (
                      <span className="block text-xs text-charcoal/50">{b.guestPhone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal/80">{formatPrice(b.priceCents)}</td>
                  <td className="px-4 py-3">
                    <SourceBadge source={b.source} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  {/* Per-row actions wired in Tasks 9–10 */}
                  <td className="px-4 py-3">{/* reserved */}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
