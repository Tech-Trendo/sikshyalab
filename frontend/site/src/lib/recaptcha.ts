/**
 * Google reCAPTCHA v2 ("I'm not a robot") — public site key only.
 * Secret stays on the Django server (RECAPTCHA_SECRET_KEY).
 */

export const RECAPTCHA_SITE_KEY = (
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""
).trim();

export function isRecaptchaConfigured(): boolean {
  return Boolean(RECAPTCHA_SITE_KEY);
}
