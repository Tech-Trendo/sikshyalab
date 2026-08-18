/**
 * Public GA4 Measurement ID only (e.g. G-XXXXXXXXXX).
 * Never put API secrets here — Measurement IDs are safe for the browser.
 */
export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || ""
).trim();

export function isGoogleAnalyticsEnabled(): boolean {
  return Boolean(GA_MEASUREMENT_ID);
}
