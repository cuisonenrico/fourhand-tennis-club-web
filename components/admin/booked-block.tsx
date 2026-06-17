"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { formatTimeRange } from "@/lib/utils";

export interface BookedBlockProps {
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  /** Start of the (possibly merged) run. */
  startsAt: string;
  /** End of the (possibly merged) run. */
  endsAt: string;
  /** Number of consecutive hour cells this block spans. */
  span: number;
}

/**
 * A booked cell in the admin schedule. Hovering reveals the player's details in
 * a popover; clicking pins it open until an outside click or Escape. Positioned
 * `fixed` so the table's horizontal overflow never clips it.
 */
export function BookedBlock({
  guestName,
  guestEmail,
  guestPhone,
  startsAt,
  endsAt,
  span,
}: BookedBlockProps) {
  const popoverId = useId();
  const blockRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const open = hovered || pinned;

  const place = useCallback(() => {
    const el = blockRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }, []);

  // Keep the popover anchored while it's open (scroll/resize of the page).
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // While pinned, dismiss on outside click or Escape.
  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        blockRef.current?.contains(target) ||
        (target instanceof Element && target.closest(`[data-popover="${popoverId}"]`))
      ) {
        return;
      }
      setPinned(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPinned(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned, popoverId]);

  const initial = guestName ? guestName.charAt(0).toUpperCase() : "?";

  return (
    <>
      <button
        ref={blockRef}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setPinned((v) => !v)}
        className="flex h-7 w-full items-center justify-center rounded-sm bg-green text-xs font-bold text-white outline-none ring-green/40 focus-visible:ring-2"
      >
        {/* On a wide merged block, show the name; otherwise just the initial. */}
        <span className="truncate px-1">{span > 1 && guestName ? guestName : initial}</span>
      </button>

      {open && coords && (
        <div
          id={popoverId}
          data-popover={popoverId}
          role="dialog"
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-50 w-60 -translate-x-1/2 rounded-card border border-surface bg-white p-3 text-left shadow-soft"
        >
          <p className="text-sm font-semibold text-charcoal">{guestName ?? "Booked"}</p>
          <p className="mt-0.5 text-xs text-charcoal/60">{formatTimeRange(startsAt, endsAt)}</p>
          <div className="mt-2 space-y-1 text-xs text-charcoal/80">
            {guestEmail && (
              <a
                href={`mailto:${guestEmail}`}
                className="flex items-center gap-1.5 hover:text-green"
              >
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{guestEmail}</span>
              </a>
            )}
            {guestPhone && (
              <a
                href={`tel:${guestPhone}`}
                className="flex items-center gap-1.5 hover:text-green"
              >
                <Phone size={12} className="shrink-0" />
                <span className="truncate">{guestPhone}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
