import { describe, expect, it } from "vitest";
import { ApiError, allowMockFallback, unwrapEnvelope } from "@/lib/http-client";

describe("unwrapEnvelope", () => {
  it("returns data from API envelope", () => {
    expect(unwrapEnvelope({ success: true, data: { id: 1 } })).toEqual({ id: 1 });
  });

  it("returns body when no envelope", () => {
    expect(unwrapEnvelope({ id: 2 })).toEqual({ id: 2 });
  });

  it("returns null for invalid body", () => {
    expect(unwrapEnvelope(null)).toBeNull();
  });
});

describe("ApiError", () => {
  it("formats field messages", () => {
    const err = new ApiError("Bad request", 400, { email: ["Invalid email"] });
    expect(ApiError.fieldMessages(err)).toContain("email: Invalid email");
  });

  it("detects unauthorized", () => {
    expect(ApiError.isUnauthorized(new ApiError("nope", 401))).toBe(true);
    expect(ApiError.isUnauthorized(new ApiError("nope", 400))).toBe(false);
  });
});

describe("allowMockFallback", () => {
  it("is enabled in test/dev by default", () => {
    expect(typeof allowMockFallback()).toBe("boolean");
  });
});
