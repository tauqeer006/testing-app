const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Users Routes", () => {
  test("GET /api/users returns 200, array of seeded users, and X-DB-Served-By header", async () => {
    const res = await request(BASE_URL).get("/api/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(10);
    expect(res.headers["x-db-served-by"]).toBeDefined();
    expect(["PRIMARY", "SECONDARY"]).toContain(res.headers["x-db-served-by"]);

    const user = res.body[0];
    expect(user).toHaveProperty("ID");
    expect(user).toHaveProperty("NAME");
    expect(user).toHaveProperty("EMAIL");
  });

  test("GET /api/users/:id returns 200 for existing user", async () => {
    const res = await request(BASE_URL).get("/api/users/1");
    expect(res.status).toBe(200);
    expect(res.body.ID || res.body.id).toBe(1);
    expect(res.headers["x-db-served-by"]).toBeDefined();
  });

  test("GET /api/users/:id returns 404 for non-existent user", async () => {
    const res = await request(BASE_URL).get("/api/users/999999");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /api/next-user-id (TRAP endpoint) uses writePool and returns nextId", async () => {
    const res = await request(BASE_URL).get("/api/next-user-id");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nextId");
    expect(typeof res.body.nextId).toBe("number");
  });

  test("POST /api/users creates a new user via writePool and users_seq.NEXTVAL", async () => {
    const uniqueEmail = `test.user.${Date.now()}@example.com`;
    const res = await request(BASE_URL)
      .post("/api/users")
      .send({
        name: "Test User Automation",
        email: uniqueEmail,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("Test User Automation");
    expect(res.body.email).toBe(uniqueEmail);
  });
});
