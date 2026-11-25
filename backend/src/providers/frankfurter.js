const PROVIDER_NAME = "frankfurter";

function getUrl(base) {
  const upperBase = base.toUpperCase();
  const lowerBase = base.toLowerCase();
  const isMock = process.env.USE_MOCK_PROVIDERS === "true";
  const defaultUrl = isMock
    ? "http://mock-providers:4000/frankfurter/v1/latest?base={BASE}"
    : "https://api.frankfurter.dev/v1/latest?base={BASE}";
  const template = process.env.FRANKFURTER_URL || defaultUrl;
  return template.replace(/\{BASE\}/g, upperBase).replace(/\{base\}/g, lowerBase);
}

async function fetchRates(base = "USD") {
  const upperBase = base.toUpperCase();
  const url = getUrl(upperBase);
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
      throw new Error(`[${PROVIDER_NAME}] HTTP error ${response.status} (${response.statusText})`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new Error(`[${PROVIDER_NAME}] Invalid JSON response: ${parseErr.message}`);
    }

    // Strict validation
    if (!data || typeof data !== "object") {
      throw new Error(`[${PROVIDER_NAME}] Response payload must be an object`);
    }
    if (!data.date || typeof data.date !== "string") {
      throw new Error(`[${PROVIDER_NAME}] Response missing or invalid 'date' field`);
    }
    if (!data.rates || typeof data.rates !== "object") {
      throw new Error(`[${PROVIDER_NAME}] Response missing or invalid 'rates' object`);
    }

    const rates = {};
    for (const [curr, rate] of Object.entries(data.rates)) {
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`[${PROVIDER_NAME}] Invalid rate value for currency '${curr}': ${rate}`);
      }
      rates[curr.toUpperCase()] = rate;
    }

    // Frankfurter does not include the base currency in rates; adapter must add it
    rates[upperBase] = 1.0;

    return {
      base: upperBase,
      rates,
      provider: PROVIDER_NAME,
      sourceDate: String(data.date),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`[${PROVIDER_NAME}] Request timed out after 5000ms`);
    }
    throw new Error(err.message.startsWith(`[${PROVIDER_NAME}]`) ? err.message : `[${PROVIDER_NAME}] ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
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
