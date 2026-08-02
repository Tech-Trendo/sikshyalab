import { describe, expect, it } from "vitest";
import { resolveApiBase } from "@/lib/api-base";

describe("resolveApiBase", () => {
  it("returns an absolute http(s) API base", () => {
    const base = resolveApiBase();
    expect(base.startsWith("http")).toBe(true);
    expect(base.endsWith("/")).toBe(false);
    expect(base.includes("/api/v1")).toBe(true);
  });

  it("never returns relative /api/v1 alone", () => {
    // Relative-only fallback is forbidden (Vite proxy hangs with TanStack Start).
    expect(resolveApiBase()).not.toBe("/api/v1");
  });
});
