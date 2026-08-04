"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  Menu,
  Phone,
  Twitter,
  X,
  Youtube,
} from "lucide-react";
import { navLinks } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ShikshaLabLogo } from "@/components/brand/ShikshaLabLogo";
import { SITE_CONTAINER_CLASS } from "@/components/brand/Section";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { usePublicData } from "@/hooks/usePublicData";
import { groupCoursesByCategory } from "@/lib/course-categories";

const PAGE_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/events", label: "Events" },
  { href: "/career", label: "Career Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/verify", label: "Verify Certificate" },
];

const SOCIAL_NETWORKS = [
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "twitter", label: "Twitter", Icon: Twitter },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { key: "youtube", label: "YouTube", Icon: Youtube },
  { key: "instagram", label: "Instagram", Icon: Instagram },
] as const;

const NAV_LINK =
  "inline-flex min-h-11 items-center gap-1 rounded-[5px] px-3.5 py-2 text-sm font-semibold transition-all duration-300 ease-in-out hover:bg-brand-lighten-02";

/** Top utility strip — same contact + socials as Contact page / site settings. */
function SiteContactBar() {
  const { contact, settings } = usePublicData();
  const socialLinks = settings?.social_links ?? {};

  const socials = useMemo(
    () =>
      SOCIAL_NETWORKS.map(({ key, label, Icon }) => {
        const href =
          socialLinks[key] ||
          socialLinks[label] ||
          socialLinks[label.toLowerCase()] ||
          "";
        return { key, label, Icon, href: href.trim() };
      }).filter((s) => s.href && s.href !== "#"),
    [socialLinks],
  );

  const phone = contact.phone?.trim();
  const email = contact.email?.trim();
  if (!phone && !email && !socials.length) return null;

  return (
    <div className="border-b border-white/10 bg-brand-navy text-white">
      <div className={cn(SITE_CONTAINER_CLASS, "flex min-h-10 items-center justify-between gap-2 py-1 sm:min-h-11 sm:gap-3")}>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px] sm:gap-5 sm:text-[13px]">
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 truncate text-white/90 transition-colors hover:text-white sm:max-w-none"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
              <span className="truncate">{phone}</span>
            </a>
          ) : null}
          {phone && email ? (
            <span className="hidden h-3 w-px bg-white/20 sm:block" aria-hidden />
          ) : null}
          {email ? (
            <a
              href={`mailto:${email}`}
              className="hidden min-w-0 items-center gap-1.5 truncate text-white/90 transition-colors hover:text-white sm:inline-flex"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
              <span className="truncate">{email}</span>
            </a>
          ) : null}
        </div>

        {socials.length > 0 ? (
          <ul className="flex shrink-0 items-center gap-0.5 sm:gap-1.5" aria-label="Social media">
            {socials.map(({ key, label, Icon, href }) => (
              <li key={key}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:h-11 sm:w-11"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function Header() {
  const pathname = usePathname() || "/";
  const { courses, categories, settings } = usePublicData();
  const logoSrc = settings?.logo || undefined;
  const headerRef = useRef<HTMLElement>(null);
  const coursesByCategory = useMemo(() => {
    const order = categories.map((c) => c.title).filter(Boolean);
    return groupCoursesByCategory(courses, { mode: "all", categoryOrder: order });
  }, [courses, categories]);
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const [mobilePagesOpen, setMobilePagesOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState<string | null>(null);

  const solid = !isHome || scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setOpen(false);
    setCoursesOpen(false);
    setPagesOpen(false);
  }, [pathname]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const publishHeight = () => {
      document.documentElement.style.setProperty(
        "--site-header-height",
        `${el.offsetHeight}px`,
      );
    };
    publishHeight();
    const ro = new ResizeObserver(publishHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--site-header-height");
    };
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <motion.header
        ref={headerRef}
        initial={false}
        animate={{
          backgroundColor: solid ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.92)",
          boxShadow: solid ? "0 8px 30px -12px rgba(11,26,59,0.18)" : "0 0 0 0 transparent",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 backdrop-blur-[2px] transition-all duration-brand ease-in-out",
          solid && "shadow-brand-soft border-b border-brand-border/80",
        )}
      >
        <AnnouncementBar />
        <SiteContactBar />
        <div className={cn(SITE_CONTAINER_CLASS, "grid h-[4.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:h-[5.25rem] sm:gap-3 lg:grid-cols-[1fr_auto_1fr] lg:h-[5.75rem]")}>
          {/* Left — brand mark only */}
          <Link
            href="/"
            className="min-w-0 justify-self-start"
            aria-label="ShikshaLab home"
          >
            <ShikshaLabLogo
              src={logoSrc}
              imageClassName="h-[2.75rem] max-w-[min(100%,160px)] sm:h-[3.25rem] sm:max-w-[220px] lg:h-16 lg:max-w-[280px]"
            />
          </Link>

          {/* Center nav */}
          <nav className="hidden items-center justify-self-center gap-0.5 lg:flex">
            {navLinks.map((l) => {
              if (l.label === "Courses") {
                return (
                  <div
                    key={l.href}
                    className="relative"
                    onMouseEnter={() => setCoursesOpen(true)}
                    onMouseLeave={() => setCoursesOpen(false)}
                  >
                    <button
                      type="button"
                      aria-expanded={coursesOpen}
                      aria-haspopup="true"
                      onClick={() => {
                        setCoursesOpen((v) => !v);
                        setPagesOpen(false);
                      }}
                      className={cn(
                        NAV_LINK,
                        isActive(l.href)
                          ? "text-brand-orange"
                          : "text-brand-navy hover:text-brand-orange",
                      )}
                    >
                      Courses
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", coursesOpen && "rotate-180")} />
                    </button>
                    {coursesOpen && (
                      <div className="absolute left-1/2 top-full z-50 w-[min(94vw,52rem)] -translate-x-1/2 pt-2">
                        <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-xl">
                          {coursesByCategory.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-brand-body">No courses yet.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-x-2 gap-y-4 p-3 md:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
                              {coursesByCategory.map((group) => (
                                <div key={group.category} className="min-w-0">
                                  <Link
                                    href={`/courses?category=${encodeURIComponent(group.category)}`}
                                    className="block rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-orange hover:bg-brand-lighten-01"
                                  >
                                    {group.category}
                                  </Link>
                                  <div className="mt-0.5 flex flex-col">
                                    {group.courses.slice(0, 6).map((c) => (
                                      <Link
                                        key={`${group.category}-${c.slug}`}
                                        href={`/courses/${c.slug}`}
                                        className={cn(
                                          "block min-h-9 rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-navy hover:bg-brand-lighten-02 hover:text-brand-orange",
                                          isActive(`/courses/${c.slug}`) && "text-brand-orange",
                                        )}
                                      >
                                        {c.title}
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <Link
                            href="/courses"
                            className="block border-t border-brand-border bg-brand-lighten-01 px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:text-brand-orange"
                          >
                            Browse all courses →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (l.label === "Pages") {
                return (
                  <div
                    key={l.href}
                    className="relative"
                    onMouseEnter={() => setPagesOpen(true)}
                    onMouseLeave={() => setPagesOpen(false)}
                  >
                    <button
                      type="button"
                      aria-expanded={pagesOpen}
                      aria-haspopup="true"
                      onClick={() => {
                        setPagesOpen((v) => !v);
                        setCoursesOpen(false);
                      }}
                      className={cn(
                        NAV_LINK,
                        PAGE_LINKS.some((p) => isActive(p.href))
                          ? "text-brand-orange"
                          : "text-brand-navy hover:text-brand-orange",
                      )}
                    >
                      Pages
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pagesOpen && "rotate-180")} />
                    </button>
                    {pagesOpen && (
                      <div className="absolute left-1/2 top-full z-50 w-[min(92vw,36rem)] -translate-x-1/2 pt-2">
                        <div className="overflow-hidden rounded-xl border border-brand-border bg-white p-3 shadow-xl">
                          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                            {PAGE_LINKS.map((p) => (
                              <Link
                                key={p.href}
                                href={p.href}
                                className={cn(
                                  "block min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-lighten-02 hover:text-brand-orange",
                                  isActive(p.href) && "text-brand-orange",
                                )}
                              >
                                {p.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    NAV_LINK,
                    isActive(l.href)
                      ? "text-brand-orange"
                      : "text-brand-navy hover:text-brand-orange",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Right corner — Login */}
          <div className="flex items-center justify-self-end gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden h-11 min-h-11 items-center justify-center rounded-[5px] bg-brand-orange px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(245_166_35/28%)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-navy hover:shadow-[0_14px_28px_rgb(27_58_107/28%)] lg:inline-flex xl:px-6"
            >
              Login
            </Link>

            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-brand-navy hover:bg-black/5 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close overlay"
              className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              id="mobile-nav"
              className="fixed right-0 top-0 z-[70] flex h-full w-[min(100vw-2rem,20rem)] flex-col bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-brand-border px-4 py-3 sm:px-5 sm:py-4">
                <ShikshaLabLogo
                  src={logoSrc}
                  imageClassName="h-10 max-w-[150px] sm:h-12 sm:max-w-[180px]"
                />
                <button
                  type="button"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-black/5"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
                {navLinks.map((l) => {
                  if (l.label === "Courses") {
                    return (
                      <div key={l.href} className="rounded-xl">
                        <button
                          type="button"
                          onClick={() => setMobileCoursesOpen((v) => !v)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold",
                            isActive(l.href)
                              ? "bg-brand-lighten-01 text-brand-orange"
                              : "text-brand-navy hover:bg-brand-lighten-02 hover:text-brand-orange",
                          )}
                        >
                          Courses
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              mobileCoursesOpen && "rotate-180",
                            )}
                          />
                        </button>
                        {mobileCoursesOpen && (
                          <div className="mb-1 ml-3 space-y-1 border-l border-brand-border pl-3">
                            {coursesByCategory.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-brand-body">No courses yet.</p>
                            ) : (
                              coursesByCategory.map((group) => (
                                <div key={group.category}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMobileCategoryOpen((v) =>
                                        v === group.category ? null : group.category,
                                      )
                                    }
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold text-brand-orange"
                                  >
                                    {group.category}
                                    <ChevronDown
                                      className={cn(
                                        "h-3.5 w-3.5 transition-transform",
                                        mobileCategoryOpen === group.category && "rotate-180",
                                      )}
                                    />
                                  </button>
                                  {mobileCategoryOpen === group.category && (
                                    <div className="ml-2 space-y-0.5 border-l border-brand-border/70 pl-2">
                                      <Link
                                        href={`/courses?category=${encodeURIComponent(group.category)}`}
                                        onClick={() => setOpen(false)}
                                        className="block min-h-10 rounded-lg px-3 py-2 text-xs font-semibold text-brand-navy hover:text-brand-orange"
                                      >
                                        View all in {group.category}
                                      </Link>
                                      {group.courses.map((c) => (
                                        <Link
                                          key={`${group.category}-${c.slug}`}
                                          href={`/courses/${c.slug}`}
                                          onClick={() => setOpen(false)}
                                          className={cn(
                                            "block min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-brand-navy hover:text-brand-orange",
                                            isActive(`/courses/${c.slug}`) && "text-brand-orange",
                                          )}
                                        >
                                          {c.title}
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                            <Link
                              href="/courses"
                              onClick={() => setOpen(false)}
                              className="block min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-navy hover:text-brand-orange"
                            >
                              Browse all courses →
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (l.label === "Pages") {
                    return (
                      <div key={l.href} className="rounded-xl">
                        <button
                          type="button"
                          onClick={() => setMobilePagesOpen((v) => !v)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold",
                            PAGE_LINKS.some((p) => isActive(p.href))
                              ? "bg-brand-lighten-01 text-brand-orange"
                              : "text-brand-navy hover:bg-brand-lighten-02 hover:text-brand-orange",
                          )}
                        >
                          Pages
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              mobilePagesOpen && "rotate-180",
                            )}
                          />
                        </button>
                        {mobilePagesOpen && (
                          <div className="mb-1 ml-3 space-y-1 border-l border-brand-border pl-3">
                            {PAGE_LINKS.map((p) => (
                              <Link
                                key={p.href}
                                href={p.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                  "block min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold",
                                  isActive(p.href)
                                    ? "text-brand-orange"
                                    : "text-brand-navy hover:text-brand-orange",
                                )}
                              >
                                {p.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-xl px-4 py-3 text-[15px] font-semibold",
                        isActive(l.href)
                          ? "bg-brand-lighten-01 text-brand-orange"
                          : "text-brand-navy hover:bg-brand-lighten-02 hover:text-brand-orange",
                      )}
                    >
                      {l.label}
                    </Link>
                  );
                })}
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex h-12 min-h-12 w-full items-center justify-center rounded-[5px] bg-brand-orange px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(245_166_35/28%)] transition-all duration-300 hover:bg-brand-navy hover:shadow-[0_14px_28px_rgb(27_58_107/28%)]"
                >
                  Login
                </Link>
               
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export const HEADER_OFFSET =
  "pt-[var(--site-header-height,8.5rem)] sm:pt-[var(--site-header-height,9rem)]";
