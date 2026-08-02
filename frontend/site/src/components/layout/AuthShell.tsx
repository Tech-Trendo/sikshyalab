import type { ReactNode } from "react";
import { ShikshaLabLogo } from "@/components/brand/ShikshaLabLogo";
import { cn } from "@/lib/utils";

/** Shared auth card chrome matching the landing login style. */
export function AuthShell({
  title,
  subtitle,
  children,
  compact = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** When true (e.g. under PageHero), skip logo + heading to avoid duplication. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-brand-lighten-02 px-4",
        compact ? "py-12 md:py-16" : "min-h-[70vh] py-16",
      )}
    >
      <div className="w-full max-w-md rounded-brand-lg bg-white p-6 shadow-brand-soft sm:p-8">
        {!compact ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <ShikshaLabLogo />
            <h1 className="font-secondary text-2xl font-bold tracking-tight text-brand-navy-dark">{title}</h1>
            <p className="text-sm text-brand-body">{subtitle}</p>
          </div>
        ) : null}
        <div className={cn(!compact && "mt-6")}>{children}</div>
      </div>
    </div>
  );
}

export const authInputClass = "h-11 rounded-full border-brand-border";
export const authButtonClass =
  "h-12 w-full rounded-full bg-brand-gradient text-[15px] font-semibold !text-white transition-colors hover:brightness-105";
