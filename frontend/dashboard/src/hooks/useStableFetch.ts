import { useEffect, useRef } from "react";

/**
 * Run hydrate() once per sourceKey (e.g. record id). Avoids resetting local form
 * state when parent query data gets a new object reference on refetch.
 */
export function useHydrateOnce(sourceKey: string | number | undefined | null, hydrate: () => void) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (sourceKey == null || sourceKey === "") return;
    const key = String(sourceKey);
    if (seen.current.has(key)) return;
    seen.current.add(key);
    hydrate();
    // hydrate is intentionally omitted — callers should pass a stable closure or inline sync setState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);
}

/**
 * Fetch once when `key` is set. Does not refetch when fetcher identity changes.
 */
export function useMountFetch(key: string | number | undefined | null, fetcher: () => void | Promise<void>) {
  const keyRef = useRef<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (key == null || key === "") return;
    const k = String(key);
    if (keyRef.current === k) return;
    keyRef.current = k;
    void fetcherRef.current();
  }, [key]);
}
