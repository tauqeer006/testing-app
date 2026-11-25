const PROVIDER_NAME = "currency_api_cdn";

function getPrimaryUrl(base) {
  const lowerBase = base.toLowerCase();
  const upperBase = base.toUpperCase();
  const isMock = process.env.USE_MOCK_PROVIDERS === "true";
  const defaultUrl = isMock
    ? "http://mock-providers:4000/currency_api_cdn/v1/currencies/{base}.json"
    : "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.json";
  const template = process.env.CURRENCY_API_URL_PRIMARY || defaultUrl;
  return template.replace(/\{base\}/g, lowerBase).replace(/\{BASE\}/g, upperBase);
}

function getMirrorUrl(base) {
  const lowerBase = base.toLowerCase();
  const upperBase = base.toUpperCase();
  const isMock = process.env.USE_MOCK_PROVIDERS === "true";
  const defaultUrl = isMock
    ? "http://mock-providers:4000/currency_api_pages/v1/currencies/{base}.json"
    : "https://latest.currency-api.pages.dev/v1/currencies/{base}.json";
  const template = process.env.CURRENCY_API_URL_MIRROR || defaultUrl;
  return template.replace(/\{base\}/g, lowerBase).replace(/\{BASE\}/g, upperBase);
}

async function fetchFromUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "failover-test-app/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} (${response.statusText})`);
    }

    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 5000ms");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRates(base = "USD") {
  const upperBase = base.toUpperCase();
  const lowerBase = base.toLowerCase();
  const primaryUrl = getPrimaryUrl(upperBase);
  const mirrorUrl = getMirrorUrl(upperBase);

  let data = null;
  let primaryError = null;

  // Try Primary URL first
  try {
    data = await fetchFromUrl(primaryUrl);
  } catch (err) {
    primaryError = err;
  }

  // Try Mirror URL if primary failed
  if (!data) {
    try {
      data = await fetchFromUrl(mirrorUrl);
    } catch (mirrorErr) {
      throw new Error(
        `[${PROVIDER_NAME}] Both primary and mirror hosts failed. Primary: ${primaryError?.message}, Mirror: ${mirrorErr.message}`
      );
    }
  }

  // Strict validation
  if (!data || typeof data !== "object") {
    throw new Error(`[${PROVIDER_NAME}] Response payload must be an object`);
  }
  if (!data.date || typeof data.date !== "string") {
    throw new Error(`[${PROVIDER_NAME}] Response missing or invalid 'date' field`);
  }

  const rawRates = data[lowerBase];
  if (!rawRates || typeof rawRates !== "object") {
    throw new Error(`[${PROVIDER_NAME}] Response missing rates object for base '${lowerBase}'`);
  }

  // The adapter must uppercase codes and keep only keys matching /^[a-z]{3}$/
  const rates = {};
  for (const [key, val] of Object.entries(rawRates)) {
    if (/^[a-z]{3}$/i.test(key)) {
      if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
        throw new Error(`[${PROVIDER_NAME}] Invalid rate value for currency '${key}': ${val}`);
      }
      rates[key.toUpperCase()] = val;
    }
  }

  if (!rates[upperBase]) {
    rates[upperBase] = 1.0;
  }

  return {
    base: upperBase,
    rates,
    provider: PROVIDER_NAME,
    sourceDate: String(data.date),
    fetchedAt: new Date().toISOString(),
  };
}

async function probe() {
  const start = Date.now();
  try {
    const data = await fetchRates("USD");
    return {
      provider: PROVIDER_NAME,
      ok: true,
      latencyMs: Date.now() - start,
      error: null,
      httpStatus: 200,
    };
  } catch (err) {
    return {
      provider: PROVIDER_NAME,
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message,
      httpStatus: err.message.includes("HTTP error") ? parseInt(err.message.match(/HTTP error (\d+)/)?.[1] || "500", 10) : 500,
    };
  }
}

module.exports = {
  PROVIDER_NAME,
  fetchRates,
  probe,
};
