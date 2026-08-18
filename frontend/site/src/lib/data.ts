export type Stat = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
};

export type Category = {
  id: string;
  title: string;
  courses: number;
  icon: "code" | "palette" | "chart" | "cloud" | "shield" | "smartphone" | "brain" | "camera";
  tone: string;
};

export type Course = {
  id: string;
  title: string;
  category: string;
  price: number;
  image: string;
  instructor: { name: string; avatar: string };
  rating: number;
  lessons: number;
};

export type Instructor = {
  id: string;
  name: string;
  subject: string;
  avatar: string;
  socials: { twitter?: string; linkedin?: string; github?: string };
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
};

/** Structural nav — not content seed data */
export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/about", label: "About Us" },
  { href: "/events", label: "Events" },
  { href: "/verify", label: "Verify" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export type FaqItem = { q: string; a: string };

/** Category labels used when grouping CMS FAQs */
export const faqTabs = [
  "General Questions",
  "Community",
  "Support",
  "Admissions",
  "Certificates",
  "Batches",
  "Careers",
  "Learning",
] as const;
