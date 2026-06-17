# Resume or cancel an in-progress booking hold — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorming)

## Problem

When a guest selects slots and clicks **Continue**, `holdSlotsAction` places a
5-minute hold on those slots in the database. The session state that ties the
guest to that hold — `holdKey`, `selectedSlots`, `idemKey`, the court, and the
date — lives only in React state inside `components/booking/court-grid.tsx`.

If the guest closes the tab, navigates away, or otherwise exits abruptly during
the confirm step, that React state is lost while the database hold lingers for up
to 5 minutes. The slots then show as `held` and are unbookable — even by the same
guest — until the hold lazily expires. There is no way back into the confirm step
and no way to release the hold early.

## Goal

Let a returning guest get back to a still-live hold to either **confirm** the
booking or **cancel** it (releasing the hold immediately). Make deliberate in-app
abandonment release the hold right away, so a lingering hold can only ever result
from a genuine abrupt exit.

## Decisions (from brainstorming)

- **Persistence scope:** survive a full tab/browser close → `localStorage`.
- **Resume surface:** a non-intrusive **banner** on `/book` with **Resume** and
  **Cancel hold** actions (not an auto-reopened panel).
- **Expired hold on return:** **clear silently** — no banner, no "expired"
  message, no automatic re-hold attempt. The banner only appears while the hold's
  `expiresAt` is still in the future.
- **Resume validation:** **optimistic** — open the confirm form directly. The
  existing `confirm_booking_multi` RPC already bounces back to slot selection with
  a `slot_taken` result if anything lapsed, so no extra round-trip is needed.

## Architecture

The feature spans three thin layers, each with one clear job.

### 1. Database — release a specific hold

New migration `supabase/migrations/0005_release_hold.sql`:

```sql
create or replace function release_hold(
  p_slot_ids uuid[],
  p_hold_key text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with released as (
    update slots
    set status = 'free', hold_key = null, hold_expires_at = null
    where id = any(p_slot_ids)
      and hold_key = p_hold_key
      and status = 'held'
    returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$$;

revoke execute on function release_hold(uuid[], text) from public;
grant execute on function release_hold(uuid[], text) to service_role;
```

The `hold_key = p_hold_key AND status = 'held'` guard makes the release safe: it
cannot free a slot that has since been booked or re-held by a different session.
This mirrors the existing `release_expired_holds` shape and the codebase
convention that booking logic lives in the database.

### 2. Server action + validation

`lib/validation.ts` — add:

```ts
export const releaseHoldSchema = z.object({
  slot_ids: slotIds,
  hold_key: z.string().min(8).max(64),
});
```

`lib/booking/actions.ts` — add:

```ts
export async function releaseHoldAction(input: unknown): Promise<void> {
  const parsed = releaseHoldSchema.safeParse(input);
  if (!parsed.success) return; // releasing is best-effort; bad input is a no-op
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("release_hold", {
    p_slot_ids: parsed.data.slot_ids,
    p_hold_key: parsed.data.hold_key,
  });
  if (error) console.error("[releaseHoldAction] release_hold rpc error:", error);
}
```

Release is best-effort: if it fails, the hold still expires on its own within the
5-minute window, so the action never surfaces an error to the user.

### 3. Client — persistence module + court-grid wiring

**New module `lib/booking/pending-hold.ts`** — typed `localStorage` access with a
single key (e.g. `fourhand:pending-hold`). Shape:

```ts
interface PendingHold {
  holdKey: string;
  idemKey: string;
  expiresAt: string;   // ISO; banner only shows while in the future
  courtId: string;
  courtName: string;
  dateKey: string;
  slots: Slot[];       // enough to render the confirm form + recompute price
}
```

Exposes `readPendingHold()`, `writePendingHold(hold)`, `clearPendingHold()`. All
reads/writes are wrapped so they are safe during SSR and never throw (e.g. private
mode, disabled storage) — a storage failure degrades to "no resume", never a
crash.

**Changes in `components/booking/court-grid.tsx`:**

- **Write** the pending hold when `continueToConfirm` succeeds (right after
  `setHoldKey` / `setIdemKey` / `setPhase("confirm")`), capturing the current
  court, date, slots, and the hold's `expiresAt`.
- **Clear** the pending hold (and call `releaseHoldAction({ slot_ids, hold_key })`
  to free the slots) when:
  - `confirm` returns `confirmed` or `slot_taken` (clear only — the RPC already
    freed/booked the slots);
  - the guest clicks **Back** (confirm → slots) — they are changing their
    selection, so the old hold is released and re-created on the next Continue.
- **Keep** the pending hold alive when the guest **closes the panel**
  (`closePanel`) mid-confirm: closing is treated as stepping away, not cancelling.
  The resume banner is surfaced immediately (and again on the next page load) so
  the guest can resume or explicitly cancel. The hold's own 5-minute expiry is the
  backstop.
- **On mount**, read the pending hold:
  - if present and `expiresAt > now()` → set banner state;
  - otherwise → `clearPendingHold()` and show nothing.
- **Banner** (rendered above the court grid, only when banner state is set):
  - **Resume** → restore `dateKey`, `selectedCourtId`, `selectedSlots`,
    `holdKey`, `idemKey`; set `phase = "confirm"`; open the panel; dismiss the
    banner. `selectedCourt` resolves from the always-present active-courts list,
    and the total recomputes from the stored slots + `pricingRules`.
  - **Cancel hold** → `releaseHoldAction(...)`, `clearPendingHold()`, refresh
    availability, dismiss the banner.

## Data flow

1. Guest selects slots → **Continue** → `holdSlotsAction` holds in DB →
   `writePendingHold` mirrors the live hold to `localStorage`.
2. Guest abruptly exits → React state gone, DB hold + `localStorage` entry remain.
3. Guest reopens `/book`:
   - hold still live → banner → **Resume** (back into confirm) or **Cancel hold**
     (release + clear).
   - hold expired → entry cleared silently, normal fresh board.
4. Closing the panel mid-confirm → hold kept → resume banner shown immediately
   (and on the next load).
5. **Back** / **confirm** / **slot taken** → `clearPendingHold` (and
   `releaseHoldAction` for Back) → no orphan.

## Error handling

- `release_hold` is guarded by `hold_key` + `status = 'held'`; it is idempotent
  and safe to call when the hold has already lapsed (returns 0).
- `releaseHoldAction` swallows errors (best-effort); the timed expiry is the
  backstop.
- `pending-hold.ts` never throws; storage unavailability simply disables resume.
- Resume is optimistic; a hold that lapsed in the last seconds is caught by
  `confirm_booking_multi` returning `slot_taken`, which already routes the guest
  back to slot selection.

## Testing

- **DB / RPC:** `release_hold` frees only matching `held` slots; leaves `booked`
  slots and slots held by a different key untouched; returns 0 when nothing
  matches.
- **pending-hold module:** round-trips a `PendingHold`; returns `null` for missing
  or malformed data; never throws when storage is unavailable.
- **Flow (manual / integration):**
  - Hold → close tab → reopen → banner shows → **Resume** → confirm succeeds.
  - Hold → close tab → reopen → banner shows → **Cancel hold** → slots free again.
  - Hold → wait past expiry → reopen → no banner, entry cleared.
  - Hold → close panel → banner appears; persists across reload until resumed or
    cancelled.
  - Hold → **Back** → slot frees immediately, no banner on reload.

## Out of scope

- Cross-tab synchronization of the banner within a single open session.
- Extending/refreshing the hold (heartbeat) while the guest sits on the confirm
  form — the existing 5-minute window is unchanged.
- Any change to the single-slot legacy RPCs.
