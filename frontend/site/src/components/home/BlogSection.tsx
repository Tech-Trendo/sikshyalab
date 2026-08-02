"use client";

import Link from "next/link";
import { Calendar, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, Stagger, fadeUp } from "@/components/motion/framer";

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  cover: string;
};

export function BlogSection({ posts }: { posts: BlogPost[] }) {
  const list = posts.slice(0, 3);

  return (
    <section className="section-y bg-white">
      <div className="container-page">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#F5A623]">
            Latest Articles
          </p>
          <h2 className="text-2xl font-bold text-[#231F40] sm:text-3xl md:text-[2.15rem]">
            Get News with ShikshaLab
          </h2>
        </Reveal>

        <Stagger className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <motion.article
              key={p.slug}
              variants={fadeUp}
              className="group overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_-18px_rgba(35,31,64,0.25)] ring-1 ring-black/[0.04]"
            >
              <Link href={`/blog/${p.slug}`}>
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={p.cover}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="text-lg font-bold leading-snug text-[#181818] group-hover:text-[#1B3A6B]">
                    {p.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#6F6B80]">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> {p.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5" /> Com 0
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#6F6B80]">
                    {p.excerpt}
                  </p>
                </div>
              </Link>
            </motion.article>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
