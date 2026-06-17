"use client";

import { useState, useTransition } from "react";
import { Search, Plus, X } from "lucide-react";
import { AdminDateControl } from "@/components/admin/admin-date-control";
import {
  searchBookingsAction,
  getFreeSlotsAction,
  adminCreateBookingAction,
} from "@/lib/admin/actions";
import { formatTimeRange, formatPrice } from "@/lib/utils";
import type { AdminBookingDetail, BookingFilters } from "@/lib/admin/queries";
import type { Court, Slot } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: string }) {
  if (source === "admin") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
        Admin
      </span>
    );
  }
  // "guest" (and any unknown value) → neutral grey
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-charcoal/70">
      Guest
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
// New-phone-booking panel
// ---------------------------------------------------------------------------

interface NewBookingPanelProps {
  courts: Court[];
  onSuccess: () => void;
  onCancel: () => void;
}

function NewBookingPanel({ courts, onSuccess, onCancel }: NewBookingPanelProps) {
  const [courtId, setCourtId] = useState("");
  const [dateKey, setDateKey] = useState(() => {
    // Default to today in Manila (YYYY-MM-DD)
    return new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  });
  const [freeSlots, setFreeSlots] = useState<Slot[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notify, setNotify] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  async function loadSlots(cId: string, dKey: string) {
    if (!cId || !dKey) return;
    setLoadingSlots(true);
    setSlotError(null);
    setFreeSlots([]);
    setSelectedIds([]);
    try {
      const slots = await getFreeSlotsAction(cId, dKey);
      setFreeSlots(slots);
    } catch (err) {
      setSlotError("Could not load slots. Please try again.");
      console.error("[NewBookingPanel] loadSlots failed:", err);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleCourtChange(val: string) {
    setCourtId(val);
    loadSlots(val, dateKey);
  }

  function handleDateChange(val: string) {
    setDateKey(val);
    loadSlots(courtId, val);
  }

  function toggleSlot(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedIds.length === 0) {
      setError("Select at least one slot.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await adminCreateBookingAction({
        slot_ids: selectedIds,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        notify,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError("Unexpected error. Please try again.");
      console.error("[NewBookingPanel] submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-card border border-surface bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-surface px-5 py-4">
        <h2 className="text-base font-semibold text-charcoal">New phone booking</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-charcoal/50 hover:bg-surface hover:text-charcoal"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="divide-y divide-surface">
        {/* Court + date row */}
        <div className="flex flex-wrap gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-charcoal/60 uppercase tracking-wide">
              Court
            </label>
            <select
              value={courtId}
              onChange={(e) => handleCourtChange(e.target.value)}
              required
              className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
            >
              <option value="">Select court…</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-charcoal/60 uppercase tracking-wide">
              Date
            </label>
            <AdminDateControl value={dateKey} onChange={handleDateChange} />
          </div>
        </div>

        {/* Slot multi-select */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-charcoal/60">
            Free slots{" "}
            {selectedIds.length > 0 && (
              <span className="ml-1 text-green">({selectedIds.length} selected)</span>
            )}
          </p>

          {!courtId ? (
            <p className="text-sm text-charcoal/50">Select a court and date to see slots.</p>
          ) : loadingSlots ? (
            <p className="text-sm text-charcoal/50">Loading slots…</p>
          ) : slotError ? (
            <p className="text-sm text-red-500">{slotError}</p>
          ) : freeSlots.length === 0 ? (
            <p className="text-sm text-charcoal/50">No free slots on this day.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {freeSlots.map((slot) => {
                const selected = selectedIds.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => toggleSlot(slot.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "border-green bg-green text-white"
                        : "border-surface bg-white text-charcoal hover:border-green/50"
                    }`}
                  >
                    {formatTimeRange(slot.starts_at, slot.ends_at)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Guest details */}
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-charcoal/60">
              Guest name
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              placeholder="Full name"
              className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-charcoal/60">
              Email
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              required
              placeholder="guest@example.com"
              className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-charcoal/60">
              Phone
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              required
              placeholder="+63 9XX XXX XXXX"
              className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
            />
          </div>
        </div>

        {/* Notify + submit */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="h-4 w-4 rounded border-surface accent-green"
            />
            Send confirmation email to guest
          </label>

          <div className="flex items-center gap-3">
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="h-10 rounded-lg border border-surface px-4 text-sm font-medium text-charcoal hover:bg-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedIds.length === 0}
              className="h-10 rounded-lg bg-green px-4 text-sm font-medium text-white disabled:opacity-50 hover:bg-green/90"
            >
              {submitting ? "Booking…" : "Create booking"}
            </button>
          </div>
        </div>
      </form>
    </div>
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
  const [showNewPanel, setShowNewPanel] = useState(false);

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

  function handleNewBookingSuccess() {
    setShowNewPanel(false);
    applyFilters();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Bookings</h1>
        {!showNewPanel && (
          <button
            type="button"
            onClick={() => setShowNewPanel(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus size={15} />
            New phone booking
          </button>
        )}
      </div>

      {/* New-booking panel */}
      {showNewPanel && (
        <NewBookingPanel
          courts={courts}
          onSuccess={handleNewBookingSuccess}
          onCancel={() => setShowNewPanel(false)}
        />
      )}

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
                {/* Actions column reserved for Task 10 */}
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
                  {/* Per-row actions wired in Task 10 */}
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
