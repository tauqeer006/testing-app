const frankfurter = require("./frankfurter");
const openErApi = require("./openErApi");
const currencyApiCdn = require("./currencyApiCdn");
const cache = require("./cache");

// An agent will edit this file by exact string replacement, so use EXACTLY these top-level constants:
const PROVIDER_ORDER = ["frankfurter", "open_er_api", "currency_api_cdn"];
const PRIMARY_PROVIDER = "frankfurter";

const ADAPTERS = {
  frankfurter,
  open_er_api: openErApi,
  currency_api_cdn: currencyApiCdn,
};

async function getRates(base = "USD") {
  const upperBase = (base || "USD").toUpperCase();
  const adapter = ADAPTERS[PRIMARY_PROVIDER];

  if (!adapter) {
    throw new Error(`[${PRIMARY_PROVIDER}] Unknown or unconfigured primary provider '${PRIMARY_PROVIDER}'`);
  }

  // 1. Check in-memory fresh cache for the active provider
  const fresh = cache.getFresh(PRIMARY_PROVIDER, upperBase);
  if (fresh) {
    return fresh;
  }

  // 2. Fetch from the primary provider (NO automatic runtime fallback)
  try {
    const freshData = await adapter.fetchRates(upperBase);
    cache.set(PRIMARY_PROVIDER, upperBase, freshData);
    return {
      ...freshData,
      stale: false,
      ageSeconds: 0,
    };
  } catch (err) {
    // 3. If primary fails, serve stale cached data up to RATES_STALE_MAX_SECONDS
    const stale = cache.getStale(PRIMARY_PROVIDER, upperBase);
    if (stale) {
      return stale;
    }

    // 4. No valid fresh or stale data: throw clear error naming the provider
    const msg = err.message.startsWith(`[${PRIMARY_PROVIDER}]`)
      ? err.message
      : `[${PRIMARY_PROVIDER}] Failed to fetch rates: ${err.message}`;
    throw new Error(msg);
  }
}

async function probeAll() {
  const probePromises = PROVIDER_ORDER.map(async (name) => {
    const adapter = ADAPTERS[name];
    if (!adapter || typeof adapter.probe !== "function") {
      return {
        provider: name,
        ok: false,
        latencyMs: 0,
        error: `No probe implementation for '${name}'`,
      };
    }
    try {
      const result = await adapter.probe();
      return {
        provider: name,
        ok: result.ok,
        latencyMs: result.latencyMs,
        error: result.error,
      };
    } catch (err) {
      return {
        provider: name,
        ok: false,
        latencyMs: 0,
        error: err.message,
      };
    }
  });

  return await Promise.all(probePromises);
}

function getProviderMetadata() {
  return {
    primary: PRIMARY_PROVIDER,
    order: [...PROVIDER_ORDER],
  };
}

module.exports = {
  PROVIDER_ORDER,
  PRIMARY_PROVIDER,
  getRates,
  probeAll,
  getProviderMetadata,
};
