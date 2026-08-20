"use client";

import { Suspense, useMemo } from "react";
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
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactMap } from "@/components/contact/ContactMap";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import RingDotDecor from "@/components/RingDotDecor";
import { usePublicData } from "@/hooks/usePublicData";

export default function Page() {
  const { contact, contactPage, settings } = usePublicData();
  const title = contactPage?.title || "Get In Touch";
  const subtitle =
    contactPage?.content || "Reach out and we'll respond within 24 hours.";
  const socials = useMemo(() => {
    const socialLinks = settings?.social_links ?? {};
    return (
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
      .filter((s) => s.href && s.href !== "#");
  }, [settings?.social_links]);

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
              {
                i: Mail,
                t: "Email",
                v: contact.email,
                href: `mailto:${contact.email}`,
              },
              {
                i: Phone,
                t: "Phone",
                v: contact.phone,
                href: `tel:${contact.phone.replace(/\s/g, "")}`,
              },
              {
                i: MapPin,
                t: "Address",
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
                    <p className="text-sm font-semibold text-brand-navy-dark">
                      {x.t}
                    </p>
                    <a
                      href={x.href}
                      target={x.t === "Address" ? "_blank" : undefined}
                      rel={
                        x.t === "Address" ? "noopener noreferrer" : undefined
                      }
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
                  <p className="text-sm font-semibold text-brand-navy-dark">
                    Follow us
                  </p>
                  <ul
                    className="mt-3 flex flex-wrap gap-2"
                    aria-label="Social media"
                  >
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

          {/* Form stays outside RevealOnScroll so layout animations never remount inputs. */}
          <div className="overflow-visible lg:col-span-2">
            <RingDotDecor corner="right" dotSpacing={12} dotOffset={48}>
              <div className="card-brand relative z-10 bg-white p-5 sm:p-8">
                <h2 className="font-secondary text-xl font-bold text-brand-navy-dark">
                  Send Us a Message
                </h2>
                <p className="mt-2 text-sm text-brand-body">
                  Fill out the form and our team will get back to you shortly.
                </p>
                <div className="mt-6">
                  <Suspense
                    fallback={
                      <p className="text-sm text-brand-body">Loading form…</p>
                    }
                  >
                    <ContactForm />
                  </Suspense>
                </div>
              </div>
            </RingDotDecor>
          </div>
        </div>

        <ContactMap
          latitude={contact.latitude}
          longitude={contact.longitude}
        />
      </section>
    </SiteLayout>
  );
}
