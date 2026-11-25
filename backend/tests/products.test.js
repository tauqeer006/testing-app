const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Products Routes", () => {
  test("GET /api/products returns 200, array of products, and X-DB-Served-By header", async () => {
    const res = await request(BASE_URL).get("/api/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(15);
    expect(res.headers["x-db-served-by"]).toBeDefined();

    const product = res.body[0];
    expect(product).toHaveProperty("ID");
    expect(product).toHaveProperty("NAME");
    expect(product).toHaveProperty("PRICE");
  });

  test("GET /api/products?minPrice=50 filters products with price >= 50", async () => {
    const res = await request(BASE_URL).get("/api/products?minPrice=50");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const item of res.body) {
      const price = item.PRICE !== undefined ? item.PRICE : item.price;
      expect(Number(price)).toBeGreaterThanOrEqual(50);
    }
  });

  test("GET /api/products?currency=EUR converts product prices to EUR", async () => {
    const res = await request(BASE_URL).get("/api/products?currency=EUR");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.headers["x-provider-used"]).toBeDefined();

    const product = res.body[0];
    expect(product).toHaveProperty("convertedPrice");
    expect(product.currency).toBe("EUR");
    expect(product).toHaveProperty("provider");
    expect(typeof product.convertedPrice).toBe("number");
  });

  test("GET /api/products?currency=PKR handles unsupported currency with conversionError on frankfurter", async () => {
    const res = await request(BASE_URL).get("/api/products?currency=PKR");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const product = res.body[0];
    if (product.provider === "frankfurter") {
      expect(product).toHaveProperty("conversionError");
      expect(product.conversionError).toMatch(/PKR/);
    } else {
      expect(product).toHaveProperty("convertedPrice");
      expect(product.currency).toBe("PKR");
    }
  });

  test("GET /api/products?minPrice=invalid returns 400 Bad Request", async () => {
    const res = await request(BASE_URL).get("/api/products?minPrice=invalid");
    expect(res.status).toBe(400);
  });
});
