import type { NextConfig } from "next";

function resolveDjangoProxyTarget(): string {
  const raw = (process.env.API_PROXY_TARGET || "http://127.0.0.1:8000").replace(/\/$/, "");
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
    return "http://127.0.0.1:8000";
  }
}

const api = resolveDjangoProxyTarget();

const nextConfig: NextConfig = {
  // Prevent Next from 308-stripping trailing slashes on API routes.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      // Backend PC on LAN (split frontend/backend setup)
      { protocol: "http", hostname: "192.168.100.154", port: "8000", pathname: "/media/**" },
    ],
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
      {
        source: "/media/:path*",
        destination: `${api}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
