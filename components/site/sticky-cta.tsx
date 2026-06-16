"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** A sticky "Book a Court" CTA that follows the user after they scroll (Plan §4.1). */
export function StickyCta() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 md:hidden"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Button asChild size="lg" className="w-full max-w-sm shadow-lift">
            <Link href="/book">Book a Court</Link>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
