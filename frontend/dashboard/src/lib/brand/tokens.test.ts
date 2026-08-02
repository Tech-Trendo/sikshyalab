import { describe, expect, it } from "vitest";
import { brand } from "@/lib/brand/tokens";

describe("brand tokens", () => {
  it("defines primary brand colors", () => {
    expect(brand.colors.primary).toBe("#1B3A6B");
    expect(brand.colors.highlight).toBe("#F5A623");
  });

  it("exposes logo path and typography", () => {
    expect(brand.logo.path).toContain("shikshalab-logo");
    expect(brand.typography.sans).toContain("Plus Jakarta Sans");
  });
});
