const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Orders Routes", () => {
  test("GET /api/orders returns 200, array of orders joined with users, and X-DB-Served-By header", async () => {
    const res = await request(BASE_URL).get("/api/orders");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(20);
    expect(res.headers["x-db-served-by"]).toBeDefined();

    const order = res.body[0];
    expect(order).toHaveProperty("ID");
    expect(order).toHaveProperty("USER_ID");
    expect(order).toHaveProperty("USER_NAME");
    expect(order).toHaveProperty("USER_EMAIL");
    expect(order).toHaveProperty("STATUS");
    expect(order).toHaveProperty("TOTAL");
  });

  test("GET /api/orders/:id returns 200 for existing order", async () => {
    const res = await request(BASE_URL).get("/api/orders/1");
    expect(res.status).toBe(200);
    expect(res.body.ID || res.body.id).toBe(1);
    expect(res.headers["x-db-served-by"]).toBeDefined();
  });

  test("GET /api/orders/:id returns 404 for non-existent order", async () => {
    const res = await request(BASE_URL).get("/api/orders/999999");
    expect(res.status).toBe(404);
  });

  test("PATCH /api/orders/:id/status updates order status via writePool", async () => {
    const res = await request(BASE_URL)
      .patch("/api/orders/2/status")
      .send({ status: "PROCESSING" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PROCESSING");
    expect(res.body.id).toBe(2);
  });

  test("POST /api/orders/:id/claim (TRAP endpoint) locks and claims order on writePool", async () => {
    const res = await request(BASE_URL).post("/api/orders/3/claim");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CLAIMED");
    expect(res.body.id).toBe(3);
  });
});
