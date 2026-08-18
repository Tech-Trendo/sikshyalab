"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RecaptchaCheckbox } from "@/components/recaptcha/RecaptchaCheckbox";
import { submitContactMessage } from "@/lib/public-api";
import { isRecaptchaConfigured } from "@/lib/recaptcha";

export function ContactForm() {
  const searchParams = useSearchParams();
  const messageParam = searchParams.get("message") ?? "";
  const phoneParam = searchParams.get("phone") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    setMessage(messageParam);
    setPhone(phoneParam);
  }, [messageParam, phoneParam]);

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;

    if (!name.trim() || !email.trim() || !phone.trim() || !message.trim()) {
      toast.error("Please fill in name, email, phone, and message");
      return;
    }
    if (!isRecaptchaConfigured()) {
      toast.error("reCAPTCHA is not configured");
      return;
    }
    if (!recaptchaToken) {
      toast.error("Please complete the reCAPTCHA checkbox");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: "Website contact",
        message: message.trim(),
        recaptcha_token: recaptchaToken,
      });
      if (result.ok) {
        toast.success("Message sent", {
          description: "We'll get back to you within 24 hours.",
        });
        setName("");
        setEmail("");
        setPhone("");
        setMessage("");
        resetCaptcha();
      } else {
        const isCaptchaFailure = /recaptcha|captcha|robot/i.test(
          result.message || "",
        );
        toast.error(
          isCaptchaFailure ? "reCAPTCHA verification failed" : "Could not send message",
          {
            description:
              result.message ||
              (isCaptchaFailure
                ? "Please complete the checkbox again and resubmit."
                : "Please try again or email us directly."),
          },
        );
        resetCaptcha();
      }
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  // Button always shown; disabled until captcha verified (and while submitting).
  const canSubmit =
    Boolean(recaptchaToken) && !busy && isRecaptchaConfigured();

  return (
    <form className="grid gap-5 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
      <div>
        <Label htmlFor="contact-name" className="text-brand-navy">
          Name
        </Label>
        <Input
          id="contact-name"
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
        <Label htmlFor="contact-email" className="text-brand-navy">
          Email
        </Label>
        <Input
          id="contact-email"
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
        <Label htmlFor="contact-phone" className="text-brand-navy">
          Phone number
        </Label>
        <Input
          id="contact-phone"
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
        <Label htmlFor="contact-message" className="text-brand-navy">
          Message
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us more…"
          required
          className="mt-1.5 rounded-brand border-brand-border"
        />
      </div>
      <div className="sm:col-span-2">
        <RecaptchaCheckbox
          resetKey={captchaKey}
          onTokenChange={setRecaptchaToken}
        />
      </div>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="h-12 w-full rounded-full bg-brand-gradient px-8 font-semibold !text-white shadow-none transition-colors duration-brand ease-in-out hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Sending…" : "Send message"}
        </Button>
        {!recaptchaToken && isRecaptchaConfigured() && !busy ? (
          <p className="mt-2 text-xs text-brand-body">
            Complete the &quot;I&apos;m not a robot&quot; check to enable Send
            message.
          </p>
        ) : null}
      </div>
    </form>
  );
}
