import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "@/components/layout/Providers";
import { getPageMetadata, SITE_URL } from "@/lib/seo";
import "./globals.css";

/** Site-wide typeface */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const SITE_NAME = "shikshalab";
const DEFAULT_TITLE = "shikshalab";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageMetadata("/", {
    title: DEFAULT_TITLE,
    description:
      "Learn in-demand tech skills from industry experts. Live batches, hands-on projects, and verified certificates.",
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
        (typeof page.title === "string" && page.title) || DEFAULT_TITLE,
      template: `%s — ${SITE_NAME}`,
    },
    description: page.description,
    keywords: page.keywords,
    alternates: page.alternates,
    robots: page.robots,
    openGraph: page.openGraph,
    twitter: page.twitter,
    applicationName: SITE_NAME,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-body antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
