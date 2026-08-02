"use client";

import { motion } from "framer-motion";
import { staggerItem } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/utils";

export type FeatureCardItem = {
  title: string;
  description: string;
  image: string;
};

type FeatureCardProps = {
  feature: FeatureCardItem;
  className?: string;
};

/** Single homepage feature card — driven by CMS `homepage_features`. */
export function FeatureCard({ feature, className }: FeatureCardProps) {
  return (
    <motion.article
      variants={staggerItem}
      className={cn(
        "mx-0 rounded-[10px] bg-white px-5 py-8 text-center shadow-[0_10px_40px_rgba(35,31,64,0.08)] transition-transform duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] hover:-translate-y-1.5 sm:px-10 sm:py-12",
        className,
      )}
    >
      <h3 className="font-secondary text-[20px] font-bold text-brand-navy-dark sm:text-[22px]">
        {feature.title}
      </h3>
      <p className="mt-[15px] text-[15px] leading-[1.7] text-brand-body">{feature.description}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={feature.image}
        alt=""
        className="sl-float-y-sm mx-auto mt-[30px] h-auto w-[140px] max-w-full sm:w-[170px]"
        draggable={false}
      />
    </motion.article>
  );
}
