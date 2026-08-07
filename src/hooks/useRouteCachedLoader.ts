import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RouteSessionCache } from "../lib/routeSessionCache";

interface RefreshOptions {
  force?: boolean;
  keepVisible?: boolean;
}

interface UseRouteCachedLoaderOptions<T> {
  cache: RouteSessionCache<T>;
  key: string;
  enabled?: boolean;
  load: () => Promise<T>;
  pollMs?: number;
  onError?: (error: unknown) => void;
}

export function useRouteCachedLoader<T>({
  cache,
  key,
  enabled = true,
  load,
  pollMs,
  onError,
}: UseRouteCachedLoaderOptions<T>) {
  const [data, setData] = useState<T | undefined>(() => (enabled ? cache.get(key) : undefined));
  const [loading, setLoading] = useState(() => (enabled ? cache.get(key) === undefined : false));
  const requestIdRef = useRef(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setData(undefined);
      setLoading(false);
      return;
    }

    const cached = cache.get(key);
    setData(cached);
    setLoading(cached === undefined);
  }, [cache, enabled, key]);

  const updateCachedData = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    setData((prev) => {
      const next = updater(prev);
      if (next === undefined) {
        cache.delete(key);
      } else {
        cache.set(key, next);
      }
      return next;
    });
  }, [cache, key]);

  const invalidate = useCallback(() => {
    cache.delete(key);
  }, [cache, key]);

  const refresh = useCallback(async ({ force = false, keepVisible = true }: RefreshOptions = {}) => {
    if (!enabled) return undefined;

    const cached = cache.get(key);
    if (!force && cached !== undefined) {
      setData(cached);
      setLoading(false);
      return cached;
    }

    const requestId = ++requestIdRef.current;
    if (!(keepVisible && cached !== undefined)) {
      setLoading(true);
    }

    try {
      const next = await load();
      if (requestId !== requestIdRef.current) return next;
      cache.set(key, next);
      setData(next);
      return next;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        onError?.(error);
      }
      return undefined;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [cache, enabled, key, load, onError]);

  useEffect(() => {
    if (!enabled) return;
    void refresh({ force: false, keepVisible: true });

    if (!pollMs) return;
    const interval = setInterval(() => {
      void refresh({ force: true, keepVisible: true });
    }, pollMs);
    return () => clearInterval(interval);
  }, [enabled, key, pollMs, refresh]);

  return {
    data,
    loading,
    refresh,
    invalidate,
    updateCachedData,
  };
}
