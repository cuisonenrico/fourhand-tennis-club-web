# Admin courts schedule polish + settings→landing wiring

Date: 2026-06-17

## Goal

Improve the `/admin/courts` daily schedule, allow deleting courts, and make
`/admin/settings` the source of truth for club info shown on the public landing.

## A. Reorder `/admin/courts`

Section order becomes: **Daily Schedule → Courts → Closures** (schedule first).

## B. Skeleton loading

Add `ScheduleGridSkeleton` — a pulsing placeholder (header + ~6 rows × ~10
cells). Shown whenever the grid is `loading` (initial load and every date
change), replacing the "Loading schedule…" text.

## C. Merge consecutive same-person blocks

Extend `getScheduleGrid` to fetch, per booked slot: `booking_group_id`,
`guest_email`, `guest_phone` (in addition to `guest_name`). `ScheduleCell`
gains `bookingGroupId`, `guestEmail`, `guestPhone`, `endsAt`.

In each court row, collapse runs of **adjacent booked cells** sharing the same
`bookingGroupId` (fallback: same `guestName`) into a single `<td>` with
`colSpan`, rendered as one continuous rounded block (initial/name shown once).
Held / closed / free cells render per-cell as today.

## D. Hover + tap popover

New client component `BookedBlock`. On hover it shows a popover; on click it
"pins" the popover, dismissed only by an outside click or `Escape`. Content:
guest name, merged time range, email, phone. Positioned `fixed` from the
block's measured bounding rect to avoid clipping by the table's
`overflow-x-auto`.

## E. Delete courts

`deleteCourtAction(id)`:
- Count bookings referencing the court. If > 0, return
  `{ ok: false, error: "This court has bookings. Set it to Maintenance instead of deleting." }`
  (preserves history; `bookings.court_id` has no cascade).
- Otherwise delete the court (slots + closures cascade), write an audit entry
  (`court.delete`), `revalidatePath("/admin/courts")`.

UI: a **Delete** button in each `CourtRow` behind an inline confirm dialog.

## F. Settings → landing (+ Address)

Migration `0007_settings_address_public.sql`:
- `alter table business_settings add column if not exists address text;`
- Add a public `SELECT` RLS policy on `business_settings` (branding/contact is
  public, non-sensitive).

Type + validation:
- `BusinessSettings.address: string | null`.
- `settingsSchema` gains `address` (optional, nullable).
- Settings form gains an Address field.

Landing wiring — read settings via the anon **server** client and pass values to:
- **Nav** (`clubName` prop; stays a client component, parameterized by layout).
- **Footer** (club name, address, hours, phone, email).
- **Hero** badge (hours via shared helper; locality label stays hardcoded).
- **ContactSection** (address, hours, phone, email; map query uses address).

Shared `formatHours(open, close)` util renders `"Daily · 6:00 AM – 10:00 PM"`
from two `HH:MM[:SS]` strings. A `getPublicSettings()` query (anon client,
tolerant of read failure → falls back to current hardcoded defaults) feeds the
marketing layout so Nav/Footer get values, and the landing page passes settings
to Hero/ContactSection.

## Out of scope

- Locality/city as a settings field (hero keeps a hardcoded locality label).
- Logo/accent-colour theming of the public site.
- Realtime schedule updates.
