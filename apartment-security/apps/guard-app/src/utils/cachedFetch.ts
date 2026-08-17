// Tiny in-memory cache for read-mostly reference data (entry-points, units, etc.)
// fetched redundantly across screens/tabs. Not persisted, not shared across app restarts.
// ponytail: no in-flight request coalescing — two callers racing before the first
// resolves will both hit the network once. Fine at this call volume; add a
// pending-promise map if that ever shows up as real duplicate traffic.
type CacheEntry<T> = { data: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string, fetcher: () => Promise<T>, ttlMs = 60000): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.data as T);
  }
  return fetcher().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}
