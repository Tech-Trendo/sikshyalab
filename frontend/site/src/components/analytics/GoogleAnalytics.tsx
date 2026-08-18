import Script from "next/script";
import { GA_MEASUREMENT_ID, isGoogleAnalyticsEnabled } from "@/lib/analytics";
import { GoogleAnalyticsRouteTracker } from "@/components/analytics/GoogleAnalyticsRouteTracker";

/**
 * Global GA4 loader for the marketing site.
 * Renders nothing when NEXT_PUBLIC_GOOGLE_ANALYTICS_ID is unset.
 */
export function GoogleAnalytics() {
  if (!isGoogleAnalyticsEnabled()) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      <GoogleAnalyticsRouteTracker />
    </>
  );
}
