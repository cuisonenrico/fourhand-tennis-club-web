"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  getScheduleGrid,
  type ScheduleGridData,
  type ScheduleCell,
} from "@/lib/admin/queries";
import { AdminDateControl } from "./admin-date-control";
import { todayKey, formatTime, formatDateLong } from "@/lib/utils";

// Derive an ordered list of hour labels from a flat list of cells across all rows.
function buildHours(data: ScheduleGridData): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of data.rows) {
    for (const cell of row.cells) {
      if (!seen.has(cell.startsAt)) {
        seen.add(cell.startsAt);
        ordered.push(cell.startsAt);
      }
    }
  }
  // already ordered by .order("starts_at") from Supabase
  return ordered;
}

function cellColour(status: ScheduleCell["status"]): string {
  switch (status) {
    case "booked":
      return "bg-green text-white";
    case "held":
      return "bg-amber-400 text-charcoal";
    case "closed":
      return "bg-charcoal/40 text-charcoal/60";
    default:
      return "bg-surface text-charcoal/50";
  }
}

function CellContent({ cell }: { cell: ScheduleCell }) {
  if (cell.status === "booked") {
    const initial = cell.guestName ? cell.guestName.charAt(0).toUpperCase() : "?";
    return (
      <span
        title={cell.guestName ?? undefined}
        className="flex h-full w-full items-center justify-center text-xs font-bold"
      >
        {initial}
      </span>
    );
  }
  if (cell.status === "closed") {
    return (
      <span
        aria-label="Closed"
        className="flex h-full w-full items-center justify-center text-base font-bold select-none"
      >
        /
      </span>
    );
  }
  return null;
}

export function ScheduleGrid() {
  const supabase = useMemo(() => createClient(), []);
  const [dateKey, setDateKey] = useState(todayKey);
  const [data, setData] = useState<ScheduleGridData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (dk: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getScheduleGrid(supabase, dk);
        setData(result);
      } catch (err) {
        console.error("[schedule-grid] fetch failed:", err);
        setError("Failed to load schedule. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  // Load on mount
  useEffect(() => {
    void load(dateKey);
  }, [dateKey, load]);

  function changeDate(dk: string) {
    setDateKey(dk);
    void load(dk);
  }

  const hours = data ? buildHours(data) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal">Daily Schedule</h2>
          <p className="text-sm text-charcoal/60">
            {formatDateLong(`${dateKey}T00:00:00+08:00`)}
          </p>
        </div>
        <AdminDateControl value={dateKey} onChange={changeDate} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-charcoal/70">
        <span className="font-semibold">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-surface border border-surface" />
          Free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-400" />
          Held
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-charcoal/40" />
          Closed
        </span>
      </div>

      {/* Grid */}
      <div className="rounded-card border border-surface bg-white shadow-soft overflow-x-auto">
        {loading && (
          <div className="py-10 text-center text-sm text-charcoal/50">Loading schedule…</div>
        )}
        {error && !loading && (
          <div className="py-10 text-center text-sm text-red-500">{error}</div>
        )}
        {!loading && !error && data && hours.length === 0 && (
          <div className="py-10 text-center text-sm text-charcoal/50">
            No slots found for this day.
          </div>
        )}
        {!loading && !error && data && hours.length > 0 && (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                {/* Court label column */}
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold text-charcoal border-b border-r border-surface whitespace-nowrap">
                  Court
                </th>
                {hours.map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2 text-center font-medium text-charcoal/60 border-b border-surface whitespace-nowrap"
                  >
                    {formatTime(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => {
                // Build a map for O(1) lookup: startsAt → cell
                const cellMap = new Map(row.cells.map((c) => [c.startsAt, c]));
                return (
                  <tr
                    key={row.court.id}
                    className={ri % 2 === 0 ? "bg-white" : "bg-surface/40"}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1 font-medium text-charcoal border-r border-surface whitespace-nowrap">
                      {row.court.name}
                    </td>
                    {hours.map((h) => {
                      const cell = cellMap.get(h);
                      return (
                        <td
                          key={h}
                          className="px-0.5 py-0.5 border-l border-surface"
                        >
                          {cell ? (
                            <div
                              className={`h-7 w-12 rounded-sm ${cellColour(cell.status)}`}
                            >
                              <CellContent cell={cell} />
                            </div>
                          ) : (
                            <div className="h-7 w-12" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
