import { describe, expect, it } from "vitest";
import { brand } from "@/lib/brand/tokens";

describe("brand tokens", () => {
  it("defines logo palette colors", () => {
    expect(brand.colors.orange).toBe("#F5A623");
    expect(brand.colors.navy).toBe("#1F3F66");
    expect(brand.colors.navyDark).toBe("#16304F");
  });

  it("exposes logo path and typography", () => {
    expect(brand.logo.path).toContain("shikshalab-logo");
    expect(brand.typography.primary).toContain("Poppins");
    expect(brand.typography.secondary).toContain("Poppins");
  });
});
