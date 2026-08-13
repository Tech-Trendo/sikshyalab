import type { NextConfig } from "next";

function resolveDjangoProxyTarget(): string {
  const raw = (
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_DJANGO_ORIGIN ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
  try {
    const u = new URL(raw);
    // Common misconfig: pointing proxy at the Next site instead of Django
    if (u.port === "8081" || u.port === "5173") {
      return `${u.protocol}//${u.hostname}:8000`;
    }
    // If someone appended /api or /api/v1, strip it — rewrites add /api/v1
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.origin;
  } catch {
    return "http://localhost:8000";
  }
}

const api = resolveDjangoProxyTarget();

function djangoRemotePatterns() {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "i.pravatar.cc" },
    { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
    { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
  ];

  try {
    const u = new URL(api);
    if (u.hostname && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      patterns.push({
        protocol: (u.protocol.replace(":", "") as "http" | "https") || "http",
        hostname: u.hostname,
        port: u.port || undefined,
        pathname: "/media/**",
      });
    }
  } catch {
    /* ignore */
  }

  // Optional LAN host from env
  const lan = (process.env.NEXT_PUBLIC_LAN_HOST || "").trim();
  if (lan) {
    patterns.push({
      protocol: "http",
      hostname: lan,
      port: "8000",
      pathname: "/media/**",
    });
  }

  return patterns;
}

const nextConfig: NextConfig = {
  // Prevent Next from 308-stripping trailing slashes on API routes.
  skipTrailingSlashRedirect: true,
  images: {
    // Absolute Django media URLs (http://localhost:8000/media/...) are allowed.
    // Relative /media/... must never be passed to next/image — see resolveMediaUrl().
    remotePatterns: djangoRemotePatterns(),
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*/",
        destination: `${api}/api/v1/:path*/`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${api}/api/v1/:path*/`,
      },
      // Browser / curl same-origin /media/* → Django :8000 (does not fix next/image alone)
      {
        source: "/media/:path*",
        destination: `${api}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
