function parseCoord(value: unknown): number | null {
  if (value == null || value === "") return null;

  const n =
    typeof value === "number"
      ? value
      : Number(String(value).trim());

  return Number.isFinite(n) ? n : null;
}

export function ContactMap({
  latitude,
  longitude,
}: {
  latitude?: number | string | null;
  longitude?: number | string | null;
}) {
  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);

  if (
    lat == null ||
    lng == null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return (
      <div className="container-page mt-8 sm:mt-10 lg:mt-12">
        <div className="flex min-h-[280px] items-center justify-center rounded-[var(--radius-brand-lg)] border bg-white">
          <p className="text-sm text-brand-body">
            Map location unavailable
          </p>
        </div>
      </div>
    );
  }

  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    `${lat},${lng}`
  )}&z=16&output=embed`;

  return (
    <div className="container-page mt-8 sm:mt-10 lg:mt-12">
      <div className="overflow-hidden rounded-[var(--radius-brand-lg)] border border-brand-border/80 bg-white shadow-brand-soft">
        <iframe
          title="Campus location map"
          src={mapUrl}
          className="block h-[320px] w-full border-0 sm:h-[380px] lg:h-[420px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
}