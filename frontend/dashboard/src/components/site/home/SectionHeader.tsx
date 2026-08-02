import { Reveal } from "@/components/site/motion";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
};

export function SectionHeader({ eyebrow, title, subtitle, align = "left" }: Props) {
  const centered = align === "center";
  return (
    <Reveal className={`mb-10 md:mb-14 ${centered ? "text-center" : ""}`}>
      {eyebrow && (
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
          <span className="h-px w-8 bg-highlight/60" />
          {eyebrow}
          {centered && <span className="h-px w-8 bg-highlight/60" />}
        </p>
      )}
      <h2
        className={`text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-[2.75rem] lg:leading-[1.1] ${
          centered ? "mx-auto max-w-3xl" : "max-w-2xl"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 text-base text-muted-foreground md:text-lg ${
            centered ? "mx-auto max-w-2xl" : "max-w-xl"
          }`}
        >
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
