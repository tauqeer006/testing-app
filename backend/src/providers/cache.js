const store = new Map();

function getTtlSeconds() {
  const parsed = parseInt(process.env.RATES_CACHE_TTL_SECONDS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
}

function getStaleMaxSeconds() {
  const parsed = parseInt(process.env.RATES_STALE_MAX_SECONDS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

function buildKey(provider, base) {
  return `${provider}:${base.toUpperCase()}`;
}

function getFresh(provider, base) {
  const key = buildKey(provider, base);
  const entry = store.get(key);
  if (!entry) return null;

  const ageMs = Date.now() - entry.timestamp;
  const ttlMs = getTtlSeconds() * 1000;
  if (ageMs < ttlMs) {
    return {
      ...entry.data,
      stale: false,
      ageSeconds: Math.floor(ageMs / 1000),
    };
  }
  return null;
}

function getStale(provider, base) {
  const key = buildKey(provider, base);
  const entry = store.get(key);
  if (!entry) return null;

  const ageMs = Date.now() - entry.timestamp;
  const staleMaxMs = getStaleMaxSeconds() * 1000;
  if (ageMs <= staleMaxMs) {
    return {
      ...entry.data,
      stale: true,
      ageSeconds: Math.floor(ageMs / 1000),
    };
  }

  // Beyond maximum allowable stale window, remove expired entry
  store.delete(key);
  return null;
}

function set(provider, base, data) {
  const key = buildKey(provider, base);
  store.set(key, {
    data: { ...data },
    timestamp: Date.now(),
  });
}

function clear() {
  store.clear();
}

function getEntry(provider, base) {
  const key = buildKey(provider, base);
  return store.get(key) || null;
}

module.exports = {
  getFresh,
  getStale,
  set,
  clear,
  getEntry,
  getTtlSeconds,
  getStaleMaxSeconds,
};
