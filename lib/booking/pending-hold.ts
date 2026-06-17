import type { Slot } from "@/lib/supabase/types";

/**
 * A checkout hold mirrored to localStorage so a guest who exits abruptly (closes
 * the tab, navigates away) can return to /book and resume — or cancel — the hold
 * before it lapses. Holds the minimum needed to re-render the confirm step and
 * re-issue the confirm/release calls.
 */
export interface PendingHold {
  holdKey: string;
  idemKey: string;
  expiresAt: string; // ISO; the resume banner only shows while this is in the future
  courtId: string;
  courtName: string;
  dateKey: string;
  slots: Slot[];
}

const STORAGE_KEY = "fourhand:pending-hold";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function isPendingHold(value: unknown): value is PendingHold {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.holdKey === "string" &&
    typeof v.idemKey === "string" &&
    typeof v.expiresAt === "string" &&
    typeof v.courtId === "string" &&
    typeof v.courtName === "string" &&
    typeof v.dateKey === "string" &&
    Array.isArray(v.slots) &&
    v.slots.length > 0
  );
}

/** Read the saved hold, or null if absent/malformed. Never throws. */
export function readPendingHold(): PendingHold | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingHold(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Mirror the live hold to storage. Never throws (private mode, quota, etc.). */
export function writePendingHold(hold: PendingHold): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hold));
  } catch {
    // Storage unavailable simply disables resume — not a failure worth surfacing.
  }
}

/** Drop the saved hold. Never throws. */
export function clearPendingHold(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

/** True while the hold has not yet lapsed. */
export function isHoldLive(hold: PendingHold, now: number = Date.now()): boolean {
  const expires = new Date(hold.expiresAt).getTime();
  return Number.isFinite(expires) && expires > now;
}
