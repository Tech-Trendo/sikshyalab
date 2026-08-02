import { SiteLayout } from "@/components/layout/SiteLayout";
import { Hero } from "@/components/home/Hero";
import { FeatureCards } from "@/components/home/FeatureCards";
import { About } from "@/components/home/About";
import { Courses } from "@/components/home/Courses";
import { HomeEvents } from "@/components/home/HomeEvents";
import { HomeGallery } from "@/components/home/HomeGallery";
import { Faq } from "@/components/home/Faq";
import { Testimonials } from "@/components/home/Testimonials";
import { VerifyCertificateBanner } from "@/components/home/BrochureBanner";
import { HomeBlog } from "@/components/home/HomeBlog";
import { PartnersStrip } from "@/components/home/PartnersStrip";

/**
 * Home section order:
 * Hero → Features → About → Courses → Events → Gallery → Partners → FAQ → Verify Certificate → Testimonials → Blog
 */
export default function HomePage() {
  return (
    <SiteLayout flushTop>
      <Hero />
      <FeatureCards />
      <About />
      <Courses />
      <HomeEvents />
      <HomeGallery />
      <PartnersStrip />
      <Faq />
      <VerifyCertificateBanner />
      <Testimonials />
      <HomeBlog />
    </SiteLayout>
  );
}
