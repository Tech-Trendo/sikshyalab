import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CommonProps = {
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & {
  href: string;
  className?: string;
};

const primaryCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgb(27_58_107/28%)] transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-brand-orange hover:shadow-[0_16px_36px_rgb(245_166_35/36%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:translate-y-0";

const secondaryCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-brand-navy bg-transparent px-6 text-sm font-semibold text-brand-navy transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-brand-orange hover:bg-brand-orange hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:translate-y-0";

export function PrimaryButton({ children, className, href, ...props }: ButtonAsButton | ButtonAsLink) {
  if (href) {
    return (
      <Link href={href} className={cn(primaryCls, className)}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cn(primaryCls, className)} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, href, ...props }: ButtonAsButton | ButtonAsLink) {
  if (href) {
    return (
      <Link href={href} className={cn(secondaryCls, className)}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cn(secondaryCls, className)} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
}
