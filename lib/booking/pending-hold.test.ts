import { describe, it, expect, beforeEach } from "vitest";
import {
  readPendingHold,
  writePendingHold,
  clearPendingHold,
  isHoldLive,
  type PendingHold,
} from "@/lib/booking/pending-hold";
import type { Slot } from "@/lib/supabase/types";

const slot: Slot = {
  id: "11111111-1111-1111-1111-111111111111",
  court_id: "22222222-2222-2222-2222-222222222222",
  starts_at: "2026-07-01T02:00:00Z",
  ends_at: "2026-07-01T03:00:00Z",
  status: "held",
  hold_expires_at: "2026-07-01T01:05:00Z",
  hold_key: "hold-key-1234",
};

const hold: PendingHold = {
  holdKey: "hold-key-1234",
  idemKey: "idem-key-1234",
  expiresAt: "2026-07-01T01:05:00Z",
  courtId: slot.court_id,
  courtName: "Court 1",
  dateKey: "2026-07-01",
  slots: [slot],
};

beforeEach(() => {
  clearPendingHold();
});

describe("pending-hold storage", () => {
  it("round-trips a saved hold", () => {
    writePendingHold(hold);
    expect(readPendingHold()).toEqual(hold);
  });

  it("returns null when nothing is saved", () => {
    expect(readPendingHold()).toBeNull();
  });

  it("clears a saved hold", () => {
    writePendingHold(hold);
    clearPendingHold();
    expect(readPendingHold()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    window.localStorage.setItem("fourhand:pending-hold", "{not json");
    expect(readPendingHold()).toBeNull();
  });

  it("returns null for a structurally invalid hold", () => {
    window.localStorage.setItem("fourhand:pending-hold", JSON.stringify({ holdKey: "x" }));
    expect(readPendingHold()).toBeNull();
  });

  it("returns null for a hold with no slots", () => {
    window.localStorage.setItem(
      "fourhand:pending-hold",
      JSON.stringify({ ...hold, slots: [] }),
    );
    expect(readPendingHold()).toBeNull();
  });
});

describe("isHoldLive", () => {
  it("is true before the expiry instant", () => {
    const now = new Date("2026-07-01T01:04:00Z").getTime();
    expect(isHoldLive(hold, now)).toBe(true);
  });

  it("is false at or after the expiry instant", () => {
    const now = new Date("2026-07-01T01:05:00Z").getTime();
    expect(isHoldLive(hold, now)).toBe(false);
  });

  it("is false for an unparseable expiry", () => {
    expect(isHoldLive({ ...hold, expiresAt: "nonsense" })).toBe(false);
  });
});
