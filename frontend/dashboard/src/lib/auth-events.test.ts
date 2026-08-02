import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_CHANGED, emitAuthChanged, onAuthChanged } from "@/lib/auth-events";

describe("auth-events", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports a stable event name", () => {
    expect(AUTH_CHANGED).toBe("shikshalab:auth-changed");
  });

  it("emitAuthChanged dispatches the event", () => {
    const target = new EventTarget();
    const spy = vi.fn();
    target.addEventListener(AUTH_CHANGED, spy);
    vi.stubGlobal("window", target);
    emitAuthChanged();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("onAuthChanged subscribes and unsubscribes", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const handler = vi.fn();
    const unsubscribe = onAuthChanged(handler);
    emitAuthChanged();
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    emitAuthChanged();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
