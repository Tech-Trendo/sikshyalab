"use client";

export function SitemapError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-brand-border bg-white px-6 py-12 text-center shadow-brand-soft"
    >
      <p className="font-secondary text-lg font-bold text-[#181818]">Couldn’t load the sitemap</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-brand-body">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
