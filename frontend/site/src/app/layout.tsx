import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { Providers } from "@/components/layout/Providers";
import { fetchSiteDefaults, getPageMetadata, SITE_URL } from "@/lib/seo";
import "./globals.css";

/** Site-wide typeface */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const defaults = await fetchSiteDefaults();
  const page = await getPageMetadata("/", {
    title: defaults.siteName,
    description: defaults.tagline,
  });

  return {
    metadataBase: new URL(SITE_URL),
    icons: {
      icon: [
        { url: "/shikshalab-logo.png", type: "image/png", sizes: "any" },
        { url: "/favicon.png", type: "image/png" },
      ],
      shortcut: "/shikshalab-logo.png",
      apple: [{ url: "/shikshalab-logo.png" }],
    },
    title: {
      default:
        (typeof page.title === "string" && page.title) || defaults.siteName,
      template: `%s — ${defaults.siteName}`,
    },
    description: page.description,
    keywords: page.keywords,
    alternates: page.alternates,
    robots: page.robots,
    openGraph: page.openGraph,
    twitter: page.twitter,
    applicationName: defaults.siteName,
    verification: {
      google: "AUeQdOoRppmQeWF0FE533AQiEzVCLiBzdG-ergqevLg",
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-body antialiased`}>
        <GoogleAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
