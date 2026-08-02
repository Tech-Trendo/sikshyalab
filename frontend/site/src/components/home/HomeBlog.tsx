"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Section, SectionContainer, SectionHeading } from "@/components/brand/Section";
import { RevealStagger, staggerItem } from "@/components/motion/RevealOnScroll";
import { BlogCard } from "@/components/blog/BlogCard";
import { usePublicData } from "@/hooks/usePublicData";

/** Home blog — newest 3 articles. */
export function HomeBlog() {
  const { blog } = usePublicData();
  const list = blog.slice(0, 3);

  if (!list.length) return null;

  return (
    <Section>
      <SectionContainer>
        <SectionHeading
          align="center"
          eyebrow="Latest Articles"
          heading="Get News with ShikshaLab"
          className="sl-section-head"
        />

        <RevealStagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <motion.div key={p.slug} variants={staggerItem}>
              <BlogCard post={p} variant="flat" />
            </motion.div>
          ))}
        </RevealStagger>

        {blog.length > 3 ? (
          <div className="mt-10 flex justify-center">
            <Link
              href="/blog"
              className="sl-view-more-btn group inline-flex w-full max-w-xs sm:w-auto"
            >
              View all articles
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        ) : null}
      </SectionContainer>
    </Section>
  );
}
