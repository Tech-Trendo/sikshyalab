"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitEventRegistration } from "@/lib/public-api";
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

  useEffect(() => {
    setMessage(
      `I'd like to register for "${eventTitle}". Please share the next steps.`,
    );
  }, [eventTitle]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in name, email, and phone");
      return;
    }
    setBusy(true);
    const result = await submitEventRegistration({
      event_slug: eventSlug,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
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
      onSuccess?.();
    } else {
      toast.error("Could not register", {
        description: result.message || "Please try again or contact us.",
      });
    }
    setBusy(false);
  };

  return (
    <form
      className={cn("grid gap-4 sm:grid-cols-2", className)}
      onSubmit={onSubmit}
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
        <button
          type="submit"
          disabled={busy}
          className="sl-hero-btn sl-hero-btn--yellow w-full !h-12 !min-h-12"
        >
          {busy ? "Submitting…" : "Register now"}
        </button>
      </div>
    </form>
  );
}
