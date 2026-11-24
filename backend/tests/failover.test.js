const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
describe("Database Failover Verification", () => {
  test("GET /api/users remains on the primary read pool", async () => {
    const res = await request(BASE_URL).get("/api/users");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("PRIMARY");
  });

  test("GET /api/users/1 remains on the primary read pool", async () => {
    const res = await request(BASE_URL).get("/api/users/1");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("PRIMARY");
  });

  test("GET /api/orders uses the secondary read pool", async () => {
    const res = await request(BASE_URL).get("/api/orders");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("SECONDARY");
  });

  test("GET /api/orders/1 uses the secondary read pool", async () => {
    const res = await request(BASE_URL).get("/api/orders/1");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("SECONDARY");
  });

  test("GET /api/products uses the secondary read pool", async () => {
    const res = await request(BASE_URL).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("SECONDARY");
  });

  test("GET /api/products?minPrice=20 uses the secondary read pool", async () => {
    const res = await request(BASE_URL).get("/api/products?minPrice=20");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("SECONDARY");
  });

  test("GET /api/stats/summary uses the secondary read pool", async () => {
    const res = await request(BASE_URL).get("/api/stats/summary");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe("SECONDARY");
  });

  test("GET /debug/db confirms write identity remains PRIMARY", async () => {
    const res = await request(BASE_URL).get("/debug/db");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("write");
    expect(res.body.write.identity).toBe("PRIMARY");
  });
});
