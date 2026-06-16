"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useIsMobile } from "@/lib/use-is-mobile";

/**
 * The availability detail surface (Plan §7.2): a side panel on desktop, a
 * bottom sheet on mobile. Expands in when a court is selected, anchored to the
 * edge it docks to. Animates transform/opacity only and respects reduced motion.
 */
export function AvailabilityPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();

  const hidden = reduce ? { opacity: 0 } : isMobile ? { y: "100%", opacity: 0.5 } : { x: "100%", opacity: 0.5 };
  const shown = reduce ? { opacity: 1 } : isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-charcoal/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={
              "fixed z-50 flex flex-col bg-white shadow-lift " +
              "inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl " +
              "md:inset-y-0 md:right-0 md:left-auto md:w-[26rem] md:max-h-none md:rounded-none md:rounded-l-3xl"
            }
          >
            <header className="flex items-start justify-between gap-4 border-b border-surface p-5">
              <div>
                <h2 className="text-lg font-bold text-charcoal">{title}</h2>
                {subtitle && <p className="text-sm text-charcoal/60">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-charcoal/60 hover:bg-surface"
              >
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
