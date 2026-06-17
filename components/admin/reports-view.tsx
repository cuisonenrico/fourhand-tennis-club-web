"use client";

import { useState, useTransition } from "react";
import { getReportAction } from "@/lib/admin/actions";
import type { ReportResult, ReportDay } from "@/lib/admin/queries";
import { formatPrice, todayKey } from "@/lib/utils";
import { Download } from "lucide-react";

function Bar({ day, max }: { day: ReportDay; max: number }) {
  const pct = max > 0 ? Math.round((day.booked / max) * 100) : 0;
  const occ = day.bookable > 0 ? Math.round((day.booked / day.bookable) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-24 shrink-0 text-xs text-charcoal/60">{day.dateKey}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface">
        <div
          className="h-full rounded bg-green/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs text-charcoal/60">{occ}%</span>
      <span className="w-24 shrink-0 text-right text-xs font-medium text-charcoal">
        {formatPrice(day.revenueCents)}
      </span>
    </div>
  );
}

interface Props {
  initialReport: ReportResult;
  initialStartKey: string;
  initialEndKey: string;
}

export function ReportsView({ initialReport, initialStartKey, initialEndKey }: Props) {
  const [startKey, setStartKey] = useState(initialStartKey);
  const [endKey, setEndKey] = useState(initialEndKey);
  const [report, setReport] = useState<ReportResult>(initialReport);
  const [isPending, startTransition] = useTransition();

  function fetch(newStart: string, newEnd: string) {
    startTransition(async () => {
      try {
        const result = await getReportAction(newStart, newEnd);
        setReport(result);
      } catch (err) {
        console.error("[ReportsView] fetch failed:", err);
      }
    });
  }

  function handleStart(v: string) {
    if (!v) return;
    setStartKey(v);
    if (v <= endKey) fetch(v, endKey);
  }

  function handleEnd(v: string) {
    if (!v) return;
    setEndKey(v);
    if (startKey <= v) fetch(startKey, v);
  }

  const maxBooked = Math.max(...report.days.map((d) => d.booked), 1);
  const totalBooked = report.days.reduce((s, d) => s + d.booked, 0);
  const totalBookable = report.days.reduce((s, d) => s + d.bookable, 0);
  const totalOcc = totalBookable > 0 ? Math.round((totalBooked / totalBookable) * 100) : 0;

  const exportHref = `/api/admin/export?start=${startKey}&end=${endKey}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-charcoal">Reports</h1>
        <a
          href={exportHref}
          download
          className="inline-flex items-center gap-2 rounded-card border border-surface bg-white px-4 py-2 text-sm font-medium text-charcoal shadow-soft hover:bg-surface"
        >
          <Download size={15} />
          Download CSV
        </a>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-charcoal/60">From</label>
        <input
          type="date"
          value={startKey}
          max={endKey}
          onChange={(e) => handleStart(e.target.value)}
          className="h-10 rounded-card border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
        />
        <label className="text-sm text-charcoal/60">To</label>
        <input
          type="date"
          value={endKey}
          min={startKey}
          max={todayKey()}
          onChange={(e) => handleEnd(e.target.value)}
          className="h-10 rounded-card border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
        />
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-charcoal">{formatPrice(report.totalRevenueCents)}</p>
        </div>
        <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Bookings</p>
          <p className="mt-1 text-2xl font-bold text-charcoal">{totalBooked}</p>
        </div>
        <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Avg Occupancy</p>
          <p className="mt-1 text-2xl font-bold text-charcoal">{totalOcc}%</p>
          <p className="mt-0.5 text-xs text-charcoal/60">{totalBooked}/{totalBookable} slots</p>
        </div>
      </div>

      {/* Per-day bar list */}
      <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
        <div className="mb-2 flex items-center gap-3 border-b border-surface pb-2">
          <span className="w-24 shrink-0 text-xs font-medium text-charcoal/50">Date</span>
          <span className="flex-1 text-xs font-medium text-charcoal/50">Occupancy</span>
          <span className="w-12 shrink-0 text-right text-xs font-medium text-charcoal/50">%</span>
          <span className="w-24 shrink-0 text-right text-xs font-medium text-charcoal/50">Revenue</span>
        </div>
        <div className={isPending ? "opacity-50 transition-opacity" : ""}>
          {report.days.length === 0 ? (
            <p className="py-6 text-center text-sm text-charcoal/40">No data for this range.</p>
          ) : (
            report.days.map((d) => <Bar key={d.dateKey} day={d} max={maxBooked} />)
          )}
        </div>
      </div>
    </div>
  );
}
