"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { RECAPTCHA_SITE_KEY, isRecaptchaConfigured } from "@/lib/recaptcha";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-brand-body">Loading security check…</p>
  ),
});

type Props = {
  onTokenChange: (token: string | null) => void;
  /** Bump to remount the widget after a failed/successful submit. */
  resetKey?: number;
};

/**
 * reCAPTCHA v2 checkbox. Parent keeps the submit button visible but disabled
 * until `onTokenChange` receives a non-null token.
 */
export function RecaptchaCheckbox({ onTokenChange, resetKey = 0 }: Props) {
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  const handleChange = useCallback((token: string | null) => {
    onTokenChangeRef.current(token);
  }, []);

  const handleExpired = useCallback(() => {
    onTokenChangeRef.current(null);
  }, []);

  useEffect(() => {
    return () => {
      onTokenChangeRef.current(null);
    };
  }, []);

  if (!isRecaptchaConfigured()) {
    return (
      <p className="text-sm text-brand-body">
        reCAPTCHA is not configured. Add{" "}
        <code className="text-xs">NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" key={resetKey}>
      <ReCAPTCHA
        sitekey={RECAPTCHA_SITE_KEY}
        onChange={handleChange}
        onExpired={handleExpired}
        onErrored={handleExpired}
      />
    </div>
  );
}
