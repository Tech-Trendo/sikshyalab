import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";

export default function Page() {
  return (
    <SiteLayout flushTop>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-sm leading-relaxed text-brand-body sm:px-6 lg:px-8">
        <p>
          This Privacy Policy describes how ShikshaLab (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
          collects, uses, and shares information about you when you use our website and services.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Information we collect</h2>
        <p>
          We collect information you provide directly, such as your name, email address, and phone
          number when you sign up, enroll in a course, or contact us.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">How we use information</h2>
        <p>
          We use your information to operate our services, personalize your learning experience,
          process payments, communicate with you, and improve our platform.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Sharing</h2>
        <p>
          We do not sell your personal data. We may share limited information with trusted service
          providers under strict confidentiality agreements.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Contact</h2>
        <p>For questions about this policy, please email privacy@shikshalab.io.</p>
      </article>
    </SiteLayout>
  );
}
