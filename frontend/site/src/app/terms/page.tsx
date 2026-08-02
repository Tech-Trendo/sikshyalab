import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";

export default function Page() {
  return (
    <SiteLayout flushTop>
      <PageHero eyebrow="Legal" title="Terms & Conditions" />
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-sm leading-relaxed text-brand-body sm:px-6 lg:px-8">
        <p>
          These Terms govern your access to and use of the ShikshaLab platform. By using our services,
          you agree to be bound by these Terms.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and for
          all activities under your account.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Payments</h2>
        <p>
          Course fees and refund policies are described at the time of enrollment. Please read them
          carefully before purchasing.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Intellectual property</h2>
        <p>
          All content on our platform is owned by ShikshaLab or licensed to us. You may use it solely
          for personal, non-commercial learning.
        </p>
        <h2 className="mt-6 font-secondary text-lg font-semibold text-brand-navy">Contact</h2>
        <p>For questions, email legal@shikshalab.io.</p>
      </article>
    </SiteLayout>
  );
}
