"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  previewClosureAction,
  closeCourtAction,
  reopenClosureAction,
  type ClosureImpactRow,
} from "@/lib/admin/actions";
import type { Court } from "@/lib/supabase/types";
import type { ActiveClosure } from "@/lib/admin/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert datetime-local value (YYYY-MM-DDTHH:mm) to Manila ISO string. */
function toManilaIso(localValue: string): string {
  if (!localValue) return "";
  // datetime-local gives "YYYY-MM-DDTHH:mm" with no zone info.
  // Manila is fixed UTC+8, so we append ":00+08:00".
  return `${localValue}:00+08:00`;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// ClosurePanel
// ---------------------------------------------------------------------------

interface ClosurePanelProps {
  courts: Court[];
  closures: ActiveClosure[];
}

export function ClosurePanel({ courts, closures }: ClosurePanelProps) {
  const router = useRouter();

  // Form state
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");

  // Preview state
  const [impact, setImpact] = useState<ClosureImpactRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreviewing] = useTransition();

  // Close state
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, startClosing] = useTransition();

  // Reopen state per closure
  const [reopenPending, setReopenPending] = useState<Record<string, boolean>>({});
  const [reopenErrors, setReopenErrors] = useState<Record<string, string>>({});
  const [, startReopen] = useTransition();

  function buildInput() {
    return {
      court_id: courtId,
      starts_at: toManilaIso(startsAt),
      ends_at: toManilaIso(endsAt),
      reason,
    };
  }

  function handlePreview() {
    setPreviewError(null);
    setImpact(null);
    setCloseError(null);
    startPreviewing(async () => {
      const result = await previewClosureAction(buildInput());
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setImpact(result.impact);
    });
  }

  function handleClose() {
    setCloseError(null);
    startClosing(async () => {
      const result = await closeCourtAction(buildInput());
      if (!result.ok) {
        setCloseError(result.error);
        return;
      }
      // Reset form
      setStartsAt("");
      setEndsAt("");
      setReason("");
      setImpact(null);
      router.refresh();
    });
  }

  function handleReopen(id: string) {
    setReopenPending((p) => ({ ...p, [id]: true }));
    setReopenErrors((e) => { const next = { ...e }; delete next[id]; return next; });
    startReopen(async () => {
      const result = await reopenClosureAction(id);
      setReopenPending((p) => ({ ...p, [id]: false }));
      if (!result.ok) {
        setReopenErrors((e) => ({ ...e, [id]: result.error }));
        return;
      }
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green";

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Closure form                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
        <h2 className="mb-4 text-lg font-semibold text-charcoal">Close a court</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Court */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-charcoal">Court</label>
            <select
              className={inputClass}
              value={courtId}
              onChange={(e) => { setCourtId(e.target.value); setImpact(null); }}
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start */}
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Closure start</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={startsAt}
              onChange={(e) => { setStartsAt(e.target.value); setImpact(null); }}
            />
          </div>

          {/* End */}
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Closure end</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={endsAt}
              onChange={(e) => { setEndsAt(e.target.value); setImpact(null); }}
            />
          </div>

          {/* Reason */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-charcoal">Reason</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. heavy rain, resurfacing"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* Preview error */}
        {previewError && (
          <p className="mt-3 text-sm text-red-600">{previewError}</p>
        )}

        {/* Impact preview */}
        {impact !== null && (
          <div className="mt-4 rounded-xl border border-surface bg-surface/40 p-3">
            {impact.length === 0 ? (
              <p className="text-sm text-charcoal/60">No active bookings affected.</p>
            ) : (
              <>
                <p className="mb-2 text-sm font-medium text-charcoal">
                  {impact.length} booking slot{impact.length !== 1 ? "s" : ""} affected:
                </p>
                <ul className="space-y-1">
                  {impact.map((row, i) => (
                    <li key={i} className="text-sm text-charcoal/80">
                      {row.guestName} &lt;{row.guestEmail}&gt; —{" "}
                      {formatTs(row.startsAt)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Close error */}
        {closeError && (
          <p className="mt-3 text-sm text-red-600">{closeError}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={previewing || !courtId || !startsAt || !endsAt}
          >
            {previewing ? "Checking…" : "Preview impact"}
          </Button>

          {impact !== null && (
            <Button
              size="sm"
              onClick={handleClose}
              disabled={closing || !reason.trim()}
            >
              {closing ? "Closing…" : "Confirm closure"}
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active closures list                                                */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-charcoal">Active closures</h2>
        {closures.length === 0 ? (
          <div className="rounded-card border border-surface bg-white p-6 text-center shadow-soft">
            <p className="text-sm text-charcoal/60">No active closures.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closures.map((cl) => (
              <div
                key={cl.id}
                className="flex flex-col gap-2 rounded-card border border-surface bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-charcoal">{cl.courtName}</p>
                  <p className="mt-0.5 text-sm text-charcoal/70">
                    {formatTs(cl.starts_at)} — {formatTs(cl.ends_at)}
                  </p>
                  <p className="mt-0.5 text-sm text-charcoal/60">Reason: {cl.reason}</p>
                  {reopenErrors[cl.id] && (
                    <p className="mt-1 text-sm text-red-600">{reopenErrors[cl.id]}</p>
                  )}
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => handleReopen(cl.id)}
                  disabled={reopenPending[cl.id]}
                >
                  {reopenPending[cl.id] ? "Reopening…" : "Reopen"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
