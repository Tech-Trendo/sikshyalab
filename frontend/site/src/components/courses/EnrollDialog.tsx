"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitContactMessage } from "@/lib/public-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle?: string;
};

/** Contact-style enrollment form in a modal. */
export function EnrollDialog({ open, onOpenChange, courseTitle }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage(
      courseTitle
        ? `I'd like to enroll in "${courseTitle}". Please share the next steps.`
        : "",
    );
  }, [open, courseTitle]);

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !message.trim()) {
      toast.error("Please fill in name, email, phone, and message");
      return;
    }
    setBusy(true);
    const result = await submitContactMessage({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subject: courseTitle
        ? `Enrollment request: ${courseTitle}`
        : "Course enrollment request",
      message: message.trim(),
    });
    if (result.ok) {
      toast.success("Enrollment request sent", {
        description: "We'll get back to you within 24 hours.",
      });
      reset();
      onOpenChange(false);
    } else {
      toast.error("Could not send request", {
        description: result.message || "Please try again or contact us directly.",
      });
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-brand-border bg-white shadow-brand-med !backdrop-blur-none [background:white]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-brand-navy-dark">
            Enroll Now
          </DialogTitle>
          <DialogDescription className="text-sm text-brand-body">
            {courseTitle
              ? `Fill out the form to enroll in ${courseTitle}. Our team will contact you shortly.`
              : "Fill out the form and our team will get back to you shortly."}
          </DialogDescription>
        </DialogHeader>

        <form className="mt-2 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="enroll-name" className="text-brand-navy">
              Name
            </Label>
            <Input
              id="enroll-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className="mt-1.5 h-11 rounded-brand border-brand-border"
            />
          </div>
          <div>
            <Label htmlFor="enroll-email" className="text-brand-navy">
              Email
            </Label>
            <Input
              id="enroll-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1.5 h-11 rounded-brand border-brand-border"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="enroll-phone" className="text-brand-navy">
              Phone number
            </Label>
            <Input
              id="enroll-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+977 98XXXXXXXX"
              required
              className="mt-1.5 h-11 rounded-brand border-brand-border"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="enroll-message" className="text-brand-navy">
              Message
            </Label>
            <Textarea
              id="enroll-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more…"
              required
              className="mt-1.5 rounded-brand border-brand-border"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="sl-hero-btn w-full !h-12 !min-h-12"
            >
              {busy ? "Sending…" : "Submit enrollment"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
