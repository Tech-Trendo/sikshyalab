/** Cross-context auth signal so data providers refresh after login/logout. */

export const AUTH_CHANGED = "shikshalab:auth-changed";

export function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED));
  }
}

export function onAuthChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_CHANGED, handler);
  return () => window.removeEventListener(AUTH_CHANGED, handler);
}
