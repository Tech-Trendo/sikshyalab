"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import RingDotDecor from "@/components/RingDotDecor";
import { Label } from "@/components/ui/label";
import { submitContactMessage } from "@/lib/public-api";
import { usePublicData } from "@/hooks/usePublicData";

function ContactForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMessage(searchParams.get("message") ?? "");
    setPhone(searchParams.get("phone") ?? "");
  }, [searchParams]);

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
      subject: "Website contact",
      message: message.trim(),
    });
    if (result.ok) {
      toast.success("Message sent", { description: "We'll get back to you within 24 hours." });
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } else {
      toast.error("Could not send message", {
        description: result.message || "Please try again or email us directly.",
      });
    }
    setBusy(false);
  };

  return (
    <form className="grid gap-5 sm:grid-cols-2" onSubmit={onSubmit}>
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
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="h-12 w-full rounded-full bg-brand-gradient px-8 font-semibold !text-white shadow-none transition-colors duration-brand ease-in-out hover:brightness-105 sm:w-auto"
        >
          {busy ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}

export default function Page() {
  const { contact, contactPage, settings } = usePublicData();
  const title = contactPage?.title || "Get In Touch";
  const subtitle =
    contactPage?.content ||
    "Reach out and we'll respond within 24 hours.";
  const socialLinks = settings?.social_links ?? {};
  const socials = useMemo(
    () =>
      (
        [
          { key: "facebook", label: "Facebook", Icon: Facebook },
          { key: "twitter", label: "Twitter", Icon: Twitter },
          { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
          { key: "youtube", label: "YouTube", Icon: Youtube },
          { key: "instagram", label: "Instagram", Icon: Instagram },
        ] as const
      )
        .map((s) => ({
          ...s,
          href: (socialLinks[s.key] || socialLinks[s.label] || "").trim(),
        }))
        .filter((s) => s.href && s.href !== "#"),
    [socialLinks],
  );

  return (
    <SiteLayout flushTop>
      <PageHero
        flushHeader
        eyebrow="Contact"
        title={title}
        subtitle={subtitle}
      />
      <section className="section-y overflow-visible bg-brand-lighten-02">
        <div className="container-page grid gap-6 overflow-visible sm:gap-8 lg:grid-cols-3">
          <div className="space-y-4">
            {[
              { i: Mail, t: "Email", v: contact.email, href: `mailto:${contact.email}` },
              { i: Phone, t: "Phone", v: contact.phone, href: `tel:${contact.phone.replace(/\s/g, "")}` },
              {
                i: MapPin,
                t: "Campus",
                v: contact.address,
                href: `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`,
              },
            ].map((x, i) => (
              <RevealOnScroll key={x.t} variant="fade-up" delay={i * 0.15}>
                <div className="card-brand flex items-start gap-4 p-5 sm:p-6">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-brand bg-brand-lighten-02 text-brand-navy">
                    <x.i className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-navy-dark">{x.t}</p>
                    <a
                      href={x.href}
                      target={x.t === "Campus" ? "_blank" : undefined}
                      rel={x.t === "Campus" ? "noopener noreferrer" : undefined}
                      className="mt-1 block break-words text-[15px] text-brand-body transition-colors duration-brand ease-in-out hover:text-brand-navy"
                    >
                      {x.v}
                    </a>
                  </div>
                </div>
              </RevealOnScroll>
            ))}

            {socials.length > 0 ? (
              <RevealOnScroll variant="fade-up" delay={0.45}>
                <div className="card-brand p-6">
                  <p className="text-sm font-semibold text-brand-navy-dark">Follow us</p>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Social media">
                    {socials.map(({ key, label, Icon, href }) => (
                      <li key={key}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={label}
                          className="grid h-10 w-10 place-items-center rounded-full bg-brand-lighten-02 text-brand-navy transition-colors hover:bg-brand-orange hover:text-white"
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealOnScroll>
            ) : null}
          </div>

          <RevealOnScroll
            variant="fade-up"
            delay={0.15}
            className="overflow-visible lg:col-span-2"
          >
            <RingDotDecor corner="right" dotSpacing={12} dotOffset={48}>
              <div className="card-brand relative z-10 bg-white p-5 sm:p-8">
                <h2 className="font-secondary text-xl font-bold text-brand-navy-dark">
                  Send Us a Message
                </h2>
                <p className="mt-2 text-sm text-brand-body">
                  Fill out the form and our team will get back to you shortly.
                </p>
                <div className="mt-6">
                  <Suspense fallback={<p className="text-sm text-brand-body">Loading form…</p>}>
                    <ContactForm />
                  </Suspense>
                </div>
              </div>
            </RingDotDecor>
          </RevealOnScroll>
        </div>
      </section>
    </SiteLayout>
  );
}
