const cache = require("../src/providers/cache");

describe("In-Memory Rates Cache", () => {
  beforeEach(() => {
    cache.clear();
    process.env.RATES_CACHE_TTL_SECONDS = "1";
    process.env.RATES_STALE_MAX_SECONDS = "3";
  });

  test("serves fresh entry within TTL window", () => {
    const mockData = {
      base: "USD",
      rates: { EUR: 0.91 },
      provider: "frankfurter",
    };

    cache.set("frankfurter", "USD", mockData);
    const fresh = cache.getFresh("frankfurter", "USD");

    expect(fresh).not.toBeNull();
    expect(fresh.stale).toBe(false);
    expect(fresh.ageSeconds).toBe(0);
    expect(fresh.rates.EUR).toBe(0.91);
  });

  test("returns null for fresh cache once TTL expires, but serves stale up to max stale window", async () => {
    const mockData = {
      base: "USD",
      rates: { EUR: 0.91 },
      provider: "frankfurter",
    };

    cache.set("frankfurter", "USD", mockData);

    // Wait 1.1s for TTL (1s) to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(cache.getFresh("frankfurter", "USD")).toBeNull();

    const stale = cache.getStale("frankfurter", "USD");
    expect(stale).not.toBeNull();
    expect(stale.stale).toBe(true);
    expect(stale.ageSeconds).toBeGreaterThanOrEqual(1);
  });

  test("never reuses cache across different providers", () => {
    const frankfurterData = {
      base: "USD",
      rates: { EUR: 0.91 },
      provider: "frankfurter",
    };

    cache.set("frankfurter", "USD", frankfurterData);

    // open_er_api should have no cached data for USD
    expect(cache.getFresh("open_er_api", "USD")).toBeNull();
    expect(cache.getStale("open_er_api", "USD")).toBeNull();
  });
});
