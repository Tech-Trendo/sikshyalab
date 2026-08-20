"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RecaptchaCheckbox } from "@/components/recaptcha/RecaptchaCheckbox";
import { submitEventRegistration } from "@/lib/public-api";
import { isRecaptchaConfigured } from "@/lib/recaptcha";
import { cn } from "@/lib/utils";

type Props = {
  eventSlug: string;
  eventTitle: string;
  className?: string;
  onSuccess?: () => void;
  idPrefix?: string;
};

/** Contact-style event registration form (popup + detail page). */
export function EventRegistrationForm({
  eventSlug,
  eventTitle,
  className,
  onSuccess,
  idPrefix = "event-reg",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaError, setCaptchaError] = useState("");
  const submittingRef = useRef(false);
  const captchaOn = isRecaptchaConfigured();

  useEffect(() => {
    setMessage(
      `I'd like to register for "${eventTitle}". Please share the next steps.`,
    );
  }, [eventTitle]);

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;

    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in name, email, and phone");
      return;
    }
    if (!captchaOn) {
      setCaptchaError("reCAPTCHA is not configured. Add NEXT_PUBLIC_RECAPTCHA_SITE_KEY.");
      return;
    }
    if (!recaptchaToken) {
      setCaptchaError("Please complete the reCAPTCHA checkbox.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setCaptchaError("");
    try {
      const result = await submitEventRegistration({
        event_slug: eventSlug,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
        recaptcha_token: recaptchaToken,
      });
      if (result.ok) {
        toast.success("Registration submitted", {
          description:
            result.message ||
            "We'll email event details after admin approval.",
        });
        setName("");
        setEmail("");
        setPhone("");
        setMessage(
          `I'd like to register for "${eventTitle}". Please share the next steps.`,
        );
        resetCaptcha();
        onSuccess?.();
      } else {
        const isCaptchaFailure = /recaptcha|captcha|robot/i.test(result.message || "");
        if (isCaptchaFailure) {
          setCaptchaError(
            result.message ||
              "reCAPTCHA expired or failed. Please complete the checkbox again.",
          );
        } else {
          toast.error("Could not register", {
            description: result.message || "Please try again or contact us.",
          });
        }
        resetCaptcha();
      }
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const canSubmit = Boolean(recaptchaToken) && !busy && captchaOn;

  return (
    <form
      className={cn("grid gap-4 sm:grid-cols-2", className)}
      onSubmit={onSubmit}
      noValidate
    >
      <div>
        <Label htmlFor={`${idPrefix}-name`} className="text-brand-navy">
          Name
        </Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          required
          className="mt-1.5 h-11 rounded-brand border-brand-border"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-email`} className="text-brand-navy">
          Email
        </Label>
        <Input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="mt-1.5 h-11 rounded-brand border-brand-border"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-phone`} className="text-brand-navy">
          Phone number
        </Label>
        <Input
          id={`${idPrefix}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+977 98XXXXXXXX"
          required
          className="mt-1.5 h-11 rounded-brand border-brand-border"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-message`} className="text-brand-navy">
          Message
        </Label>
        <Textarea
          id={`${idPrefix}-message`}
          name="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us more…"
          className="mt-1.5 rounded-brand border-brand-border"
        />
      </div>
      <div className="sm:col-span-2">
        <RecaptchaCheckbox
          resetKey={captchaKey}
          onTokenChange={(token) => {
            setRecaptchaToken(token);
            if (token) setCaptchaError("");
          }}
        />
        {captchaError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {captchaError}
          </p>
        ) : !recaptchaToken && captchaOn && !busy ? (
          <p className="mt-2 text-xs text-brand-body">
            Complete the &quot;I&apos;m not a robot&quot; check to enable Register now.
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="sl-hero-btn sl-hero-btn--yellow w-full !h-12 !min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Register now"}
        </button>
      </div>
    </form>
  );
}
