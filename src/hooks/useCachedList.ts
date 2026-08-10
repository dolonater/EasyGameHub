import { useEffect, useRef, useState } from "react";

export interface CachedListOptions<T> {
  /** Re-run the cache-then-refresh cycle while this is true (e.g. `!!session`). */
  enabled: boolean;
  /** Cached (instant) reader — source of truth while offline. */
  load: () => Promise<T[]>;
  /** Network refresh, persisted to the cache. */
  refresh: () => Promise<T[]>;
  /** Optional side effect after the cached list lands (e.g. default selection). */
  onCache?: (list: T[]) => void;
}

export interface CachedListResult<T> {
  list: T[];
  setList: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  /** Refresh failed but a cached list is on screen. */
  stale: boolean;
  staleError: string | null;
  /** No cache and the refresh failed. */
  error: string | null;
}

/**
 * The cache-first two-phase list pattern used by the friends / groups lists:
 * show the cached list instantly, then silently refresh from the network. A
 * failed refresh keeps the cache on screen and flags it stale instead of
 * blanking. `load` and `refresh` must be stable references (or wrapped in
 * useCallback) — the cycle re-runs only when `enabled` flips.
 */
export function useCachedList<T>({
  enabled,
  load,
  refresh,
  onCache,
}: CachedListOptions<T>): CachedListResult<T> {
  const [list, setList] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasCacheRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStale(false);
    load()
      .then((l) => {
        if (cancelled) return;
        hasCacheRef.current = l.length > 0;
        setStaleError(null);
        setList(l);
        onCache?.(l);
      })
      .catch(() => {
        // No cache — the refresh below is the source of truth.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    refresh()
      .then((l) => {
        if (cancelled) return;
        hasCacheRef.current = false;
        setList(l);
        setStale(false);
        setStaleError(null);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (hasCacheRef.current) {
          // Cached list is on screen; refresh just failed → stale hint.
          setStaleError(msg);
          setStale(true);
        } else {
          setError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { list, setList, loading, stale, staleError, error };
}
