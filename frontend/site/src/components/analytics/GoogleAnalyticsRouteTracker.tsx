"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GA_MEASUREMENT_ID, isGoogleAnalyticsEnabled } from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function RouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== "function") return;

    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: pagePath,
    });
  }, [pathname, searchParams]);

  return null;
}

/** Sends GA4 page_view on App Router navigations (client-side route changes). */
export function GoogleAnalyticsRouteTracker() {
  if (!isGoogleAnalyticsEnabled()) return null;

  return (
    <Suspense fallback={null}>
      <RouteChangeTracker />
    </Suspense>
  );
}
