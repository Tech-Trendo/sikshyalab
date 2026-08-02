"use client";

import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

type ContactStripProps = {
  email?: string;
  phone?: string;
  emailLabel?: string;
  phoneLabel?: string;
  className?: string;
};

/** Reusable “Get in touch / Call us” strip — data-driven, no hardcoded contacts. */
export function ContactStrip({
  email,
  phone,
  emailLabel = "Get In Touch:",
  phoneLabel = "Call Us Via:",
  className,
}: ContactStripProps) {
  if (!email && !phone) return null;

  return (
    <aside
      className={cn(
        "relative flex min-h-[148px] w-full items-center overflow-hidden rounded-[10px] bg-brand-navy px-5 py-6 text-white sm:px-8 md:h-[148px] md:px-10 md:py-0",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/theme/cta-bg-imgae-07.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
        draggable={false}
      />
      <div className="relative z-[1] grid w-full items-center gap-3 text-center md:grid-cols-[1fr_auto_1fr] md:gap-5 md:text-left">
        <div className="md:pl-2">
          <p className="text-xs font-semibold text-white/70 sm:text-sm">{emailLabel}</p>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="mt-1 inline-flex items-center justify-center gap-2 text-base font-bold text-white transition-colors hover:opacity-80 sm:text-lg md:justify-start md:text-xl"
            >
              <Mail className="hidden h-4 w-4 sm:inline" />
              {email}
            </a>
          ) : (
            <p className="mt-1 text-base font-bold text-white/50">—</p>
          )}
        </div>

        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border-[3px] border-white/25 bg-white text-[11px] font-bold uppercase tracking-widest text-brand-navy shadow-brand-soft sm:h-14 sm:w-14 sm:text-xs">
          or
        </div>

        <div className="md:pr-2 md:text-right">
          <p className="text-xs font-semibold text-white/70 sm:text-sm">{phoneLabel}</p>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="mt-1 inline-flex items-center justify-center gap-2 text-base font-bold text-white transition-colors hover:opacity-80 sm:text-lg md:justify-end md:text-xl"
            >
              <Phone className="h-4 w-4" />
              {phone}
            </a>
          ) : (
            <p className="mt-1 text-base font-bold text-white/50">—</p>
          )}
        </div>
      </div>
    </aside>
  );
}
