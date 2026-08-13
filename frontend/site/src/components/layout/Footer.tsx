"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import { toast } from "sonner";
import { ShikshaLabLogo } from "@/components/brand/ShikshaLabLogo";
import { usePublicData } from "@/hooks/usePublicData";
import { submitContactMessage } from "@/lib/public-api";
import { THEME_DURATION, THEME_EASE } from "@/lib/theme-motion";

const PLATFORM_LINKS = [
  { href: "/about", label: "About" },
  { href: "/courses", label: "Courses" },
  { href: "/events", label: "Events" },
  { href: "/career", label: "Career Services" },
  { href: "/faq", label: "FAQ" },
];

const FOOTER_LINKS = [
  { href: "/contact", label: "Contact Us" },
  { href: "/login", label: "Sign in" },
  { href: "/student-portal", label: "Student Portal" },
  { href: "/teacher-portal", label: "Teacher Portal" },
  { href: "/verify", label: "Verify Certificate" },
];

const SOCIALS = [
  { Icon: Facebook, href: "#", label: "Facebook" },
  { Icon: Twitter, href: "#", label: "Twitter" },
  { Icon: Linkedin, href: "#", label: "LinkedIn" },
  { Icon: Youtube, href: "#", label: "YouTube" },
  { Icon: Instagram, href: "#", label: "Instagram" },
] as const;

export function Footer() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { contact, settings } = usePublicData();
  const logoSrc = settings?.logo || undefined;
  const footerText =
    settings?.footer_text ||
    "Premium IT training built for careers of the future. Live classes, real projects, verified certificates.";
  const socialLinks = settings?.social_links ?? {};

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitContactMessage({
        name: "Newsletter subscriber",
        email: email.trim(),
        subject: "Newsletter subscription",
        message: "Please add me to the ShikshaLab newsletter.",
      });
      if (!result.ok) {
        toast.error(result.message || "Could not subscribe. Please try again.");
        return;
      }
      toast.success("You're subscribed!");
      setEmail("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer id="sl-footer" className="sl-footer">
      <div className="sl-footer__main">
        <div className="sl-footer__inner">
          <motion.div
            className="sl-footer__grid"
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: THEME_DURATION, ease: THEME_EASE }}
          >
            {/* Brand */}
            <div>
              <Link
                href="/"
                className="inline-flex items-center rounded-[8px] bg-white px-3 py-2 shadow-md sm:px-4 sm:py-2.5"
              >
                <ShikshaLabLogo src={logoSrc} imageClassName="h-12 sm:h-14 lg:h-[3.75rem]" />
              </Link>
              <p className="sl-footer__desc mt-5 max-w-sm">{footerText}</p>
              <p className="sl-footer__contact mt-4">
                <strong>Add:</strong> {contact.address}
                <br />
                <strong>Call:</strong>{" "}
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
                <br />
                <strong>Email:</strong>{" "}
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </p>
            </div>

            {/* Online Platform */}
            <div className="sl-footer__col-platform">
              <h4 className="sl-footer__heading">Online Platform</h4>
              <ul className="sl-footer__menu">
                {PLATFORM_LINKS.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Links */}
            <div>
              <h4 className="sl-footer__heading">Links</h4>
              <ul className="sl-footer__menu">
                {FOOTER_LINKS.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contacts */}
            <div>
              <h4 className="sl-footer__heading">Contacts</h4>
              <p className="sl-footer__newsletter-text">
                Enter your email address to register to our newsletter subscription
              </p>
              <form className="sl-footer__form" onSubmit={(e) => void onSubscribe(e)}>
                <input
                  id="footer-newsletter-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="sl-footer__input"
                  aria-label="Email for newsletter"
                />
                <button type="submit" className="sl-footer__subscribe" disabled={submitting}>
                  {submitting ? "…" : "Subscribe"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </form>
              <div className="sl-footer__socials">
                {SOCIALS.map(({ Icon, href, label }) => {
                  const key = label.toLowerCase();
                  const dynamicHref = socialLinks[key] || socialLinks[label] || href;
                  if (!dynamicHref || dynamicHref === "#") return null;
                  return (
                    <a
                      key={label}
                      href={dynamicHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sl-footer__social"
                      aria-label={label}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="sl-footer__copyright">
        <span>
          Copyright {new Date().getFullYear()}{" "}
          <Link href="/">ShikshaLab</Link>. All Rights Reserved
          {" · "}
          <Link href="/privacy">Privacy</Link>
          {" · "}
          <Link href="/terms">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
