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

  test("GET /api/products?minPrice=invalid returns 400 Bad Request", async () => {
    const res = await request(BASE_URL).get("/api/products?minPrice=invalid");
    expect(res.status).toBe(400);
  });
});
