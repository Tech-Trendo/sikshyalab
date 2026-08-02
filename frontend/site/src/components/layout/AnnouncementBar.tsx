"use client";

import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePublicData } from "@/hooks/usePublicData";

/** Top announcement strip — driven by CMS `/cms/announcements/`. */
export function AnnouncementBar() {
  const { announcements } = usePublicData();
  const [dismissed, setDismissed] = useState(false);

  const active = useMemo(() => announcements[0] ?? null, [announcements]);
  const visible = Boolean(active) && !dismissed;

  if (!active) return null;

  const hrefMatch = active.content.match(/https?:\/\/\S+|\/[a-z0-9/_\-]+/i);
  const linkHref = hrefMatch?.[0]?.replace(/[.,)]+$/, "") || "/courses";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="relative overflow-hidden bg-gradient-to-r from-[#1B3A6B] via-[#1B3A6B] to-[#0f2748] text-primary-foreground"
        >
          <motion.div
            className="absolute inset-0 opacity-30"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, rgba(245,166,35,0.4), transparent)",
              backgroundSize: "200% 100%",
            }}
          />
          <motion.div
            className="container-page relative flex items-center justify-center gap-2 py-2 pr-14 text-center text-xs sm:py-2.5 sm:pr-14 sm:text-sm"
            initial={{ y: -8 }}
            animate={{ y: 0 }}
          >
            <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-highlight sm:block" />
            <p className="line-clamp-2 sm:line-clamp-none">
              <span className="font-semibold text-highlight">{active.title}:</span>{" "}
              {active.content}{" "}
              <Link href={linkHref} className="underline underline-offset-2 hover:text-highlight">
                Learn more →
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="absolute right-2 grid h-11 w-11 place-items-center rounded-md text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground sm:right-3"
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
