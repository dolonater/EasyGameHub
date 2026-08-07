export interface RouteSessionCache<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  has: (key: string) => boolean;
  delete: (key: string) => void;
  clear: () => void;
}

export function createRouteSessionCache<T>(): RouteSessionCache<T> {
  const store = new Map<string, T>();

  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
    has: (key) => store.has(key),
    delete: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

export function routeCacheKey(scope: string, params: Record<string, unknown>) {
  return `${scope}:${JSON.stringify(params)}`;
}
