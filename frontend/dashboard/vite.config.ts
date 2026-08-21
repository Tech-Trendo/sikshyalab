// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack Start plugins, React, Tailwind, path aliases, VITE_* client injection, etc.
// You can pass additional config via defineConfig({ vite: { ... } }).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Read a key from .env (vite.config runs before Vite injects env). */
function envFromDotenv(key: string): string | undefined {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) continue;
    return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/** Django host — set VITE_DJANGO_ORIGIN in .env / .env.local (production: https://app.shikshalab.com) */
const djangoTarget = (
  process.env.VITE_DJANGO_ORIGIN ||
  process.env.VITE_API_PROXY_TARGET ||
  envFromDotenv("VITE_DJANGO_ORIGIN") ||
  envFromDotenv("VITE_API_PROXY_TARGET") ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // The TanStack Router plugin owns this generated file. Letting Vite watch
      // it can turn a route-codegen write into an HMR/full-reload feedback loop.
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.vinxi/**",
          "**/.tanstack/**",
          "**/dist/**",
          "**/dist-ssr/**",
          "**/.output/**",
          "**/src/routeTree.gen.ts",
        ],
      },
      proxy: {
        "/api/v1": {
          target: djangoTarget,
          changeOrigin: true,
        },
        "/media": {
          target: djangoTarget,
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ["pdfjs-dist"],
    },
  },
});
