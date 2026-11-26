const request = require("supertest");
const express = require("express");
const debugRouter = require("../src/routes/debug");

describe("Real User Monitoring (RUM) Beacon System", () => {
  let app;
  const originalToken = process.env.RUM_DEBUG_TOKEN;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/debug", debugRouter);
    if (typeof debugRouter._resetBeaconsForTest === "function") {
      debugRouter._resetBeaconsForTest();
    }
  });

  afterAll(() => {
    process.env.RUM_DEBUG_TOKEN = originalToken;
  });

  test("POST /debug/rum ingests beacon and returns 201 with incremental ID", async () => {
    const beaconPayload = {
      path: "/",
      ttfbMs: 50,
      domContentLoadedMs: 120,
      loadMs: 250,
      fcpMs: 100,
      lcpMs: 180,
      longTaskTotalMs: 25,
      effectiveType: "4g",
      deviceMemory: 8,
      viewport: { width: 1366, height: 768 },
      resources: [],
      images: [],
      scripts: [],
    };

    const res1 = await request(app)
      .post("/debug/rum")
      .send(beaconPayload);

    expect(res1.status).toBe(201);
    expect(res1.body).toHaveProperty("status", "ok");
    expect(res1.body.id).toBe(1);

    const res2 = await request(app)
      .post("/debug/rum")
      .send({ path: "/heavy.html", loadMs: 500 });

    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe(2);
  });

  test("GET /debug/rum returns all buffered beacons with timestamps", async () => {
    await request(app)
      .post("/debug/rum")
      .send({ path: "/", loadMs: 200 });

    const req = request(app).get("/debug/rum");
    if (process.env.RUM_DEBUG_TOKEN) {
      req.set("X-Debug-Token", process.env.RUM_DEBUG_TOKEN);
    }
    const res = await req;
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].path).toBe("/");
    expect(res.body[0].loadMs).toBe(200);
    expect(res.body[0].receivedAt).toBeDefined();
    expect(new Date(res.body[0].receivedAt).toISOString()).toBe(res.body[0].receivedAt);
  });

  test("GET /debug/rum?since=<id> filters beacons strictly with id > since", async () => {
    await request(app).post("/debug/rum").send({ path: "/p1" });
    await request(app).post("/debug/rum").send({ path: "/p2" });
    await request(app).post("/debug/rum").send({ path: "/p3" });

    const req1 = request(app).get("/debug/rum?since=1");
    if (process.env.RUM_DEBUG_TOKEN) {
      req1.set("X-Debug-Token", process.env.RUM_DEBUG_TOKEN);
    }
    const resSince1 = await req1;
    expect(resSince1.status).toBe(200);
    expect(resSince1.body.length).toBe(2);
    expect(resSince1.body.map((b) => b.id)).toEqual([2, 3]);

    const req3 = request(app).get("/debug/rum?since=3");
    if (process.env.RUM_DEBUG_TOKEN) {
      req3.set("X-Debug-Token", process.env.RUM_DEBUG_TOKEN);
    }
    const resSince3 = await req3;
    expect(resSince3.status).toBe(200);
    expect(resSince3.body.length).toBe(0);
  });

  test("GET /debug/rum enforces X-Debug-Token authentication when RUM_DEBUG_TOKEN is configured", async () => {
    process.env.RUM_DEBUG_TOKEN = "secret_agent_token_123";

    // 1. Missing header -> 401
    const resNoToken = await request(app).get("/debug/rum");
    expect(resNoToken.status).toBe(401);
    expect(resNoToken.body).toHaveProperty("error", "Unauthorized");

    // 2. Invalid header -> 401
    const resWrongToken = await request(app)
      .get("/debug/rum")
      .set("X-Debug-Token", "wrong_token");
    expect(resWrongToken.status).toBe(401);

    // 3. Valid header -> 200
    const resValidToken = await request(app)
      .get("/debug/rum")
      .set("X-Debug-Token", "secret_agent_token_123");
    expect(resValidToken.status).toBe(200);
    expect(Array.isArray(resValidToken.body)).toBe(true);

    // 4. When RUM_DEBUG_TOKEN is empty/unset -> allow access
    delete process.env.RUM_DEBUG_TOKEN;
    const resNoTokenRequired = await request(app).get("/debug/rum");
    expect(resNoTokenRequired.status).toBe(200);
  });

  test("POST /debug/rum respects max buffer limit of 1000", async () => {
    // Send 1005 items
    for (let i = 1; i <= 1005; i++) {
      await request(app)
        .post("/debug/rum")
        .send({ path: `/page-${i}` });
    }

    const req = request(app).get("/debug/rum");
    if (process.env.RUM_DEBUG_TOKEN) {
      req.set("X-Debug-Token", process.env.RUM_DEBUG_TOKEN);
    }
    const res = await req;
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1000);
    // Oldest (1..5) should have shifted out; first should be id 6, last should be id 1005
    expect(res.body[0].id).toBe(6);
    expect(res.body[res.body.length - 1].id).toBe(1005);
  });
});
