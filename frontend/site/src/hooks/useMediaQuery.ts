import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. SSR-safe (defaults to false until mounted).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsTabletUp() {
  return useMediaQuery("(min-width: 768px)");
}

export function useIsDesktopUp() {
  return useMediaQuery("(min-width: 1024px)");
}
