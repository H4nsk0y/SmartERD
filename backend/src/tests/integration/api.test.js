import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { execSync } from "node:child_process";
import { app, prisma } from "../../server.js";

const normBody = (b) => (b && typeof b === "object" ? b : {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uniqEmail = (prefix = "u") => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}@test.com`;

async function cleanDb() {
  // порядок важен из-за FK
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

async function register(email, name = "Test", password = "secret123") {
  return request(app).post("/api/auth/register").send({ name, email, password });
}

async function login(email, password = "secret123") {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function registerAndGetToken(email) {
  const r = await register(email);
  expect(r.status).toBe(200);
  expect(normBody(r.body).ok).toBe(true);
  expect(typeof r.body.token).toBe("string");
  return r.body.token;
}

describe("integration: API + Prisma(Postgres)", () => {
  beforeAll(async () => {
    // Поднимаем схему в чистой тестовой БД (не зависит от миграций)
    execSync("npx prisma db push --force-reset --skip-generate", {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  });

  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
  });

  it("health: /health отвечает ok=true", async () => {
    const r = await request(app).get("/health");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.time).toBe("string");
  });

  it("auth: register -> login -> /api/me", async () => {
    const email = "a@test.com";

    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name: "Alice", email, password: "secret123" });

    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);
    expect(reg.body.user.email).toBe(email);
    expect(typeof reg.body.token).toBe("string");

    const log = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "secret123" });

    expect(log.status).toBe(200);
    expect(log.body.ok).toBe(true);
    expect(typeof log.body.token).toBe("string");

    const me = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${log.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body.ok).toBe(true);
    expect(me.body.user.email).toBe(email);
  });

  it("auth: register invalid input -> 400", async () => {
    const r = await request(app).post("/api/auth/register").send({
      name: "",
      email: "not-an-email",
      password: "1",
    });

    expect(r.status).toBe(400);
    expect(r.body.ok).toBe(false);
  });

  it("auth: register duplicate email -> 409", async () => {
    const email = "dup@test.com";

    const r1 = await register(email);
    expect(r1.status).toBe(200);
    expect(r1.body.ok).toBe(true);

    const r2 = await register(email);
    expect(r2.status).toBe(409);
    expect(r2.body.ok).toBe(false);
  });

  it("auth: login wrong password -> 401", async () => {
    const email = "pw@test.com";
    const reg = await register(email);
    expect(reg.status).toBe(200);

    const bad = await login(email, "wrong_password");
    expect(bad.status).toBe(401);
    expect(bad.body.ok).toBe(false);
  });

  it("auth: /api/me без токена -> 401", async () => {
    const r = await request(app).get("/api/me");
    expect(r.status).toBe(401);
    expect(r.body.ok).toBe(false);
  });

  it("projects: unauthorized -> 401", async () => {
    const r = await request(app).get("/api/projects");
    expect(r.status).toBe(401);
    expect(r.body.ok).toBe(false);
  });

  it("projects: invalid token -> 401", async () => {
    const r = await request(app)
      .get("/api/projects")
      .set("Authorization", "Bearer not_a_real_token");

    expect(r.status).toBe(401);
    expect(r.body.ok).toBe(false);
  });

  it("projects: create invalid input -> 400", async () => {
    const token = await registerAndGetToken("inv@test.com");

    const r = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "", data: {} });

    expect(r.status).toBe(400);
    expect(r.body.ok).toBe(false);
  });

  it("projects: create/list/get/update/delete + data реально сохраняется", async () => {
    const token = await registerAndGetToken("u@test.com");

    const payload = {
      name: "My Project",
      data: {
        entities: [{ id: "e1", name: "User", attributes: [] }],
        relationships: [],
      },
    };

    // CREATE (в ответе data нет по твоему API — это ок)
    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(created.status).toBe(200);
    expect(created.body.ok).toBe(true);
    expect(created.body.project.name).toBe("My Project");
    expect(typeof created.body.project.id).toBe("string");

    const projectId = created.body.project.id;

    // LIST (тоже без data)
    const list = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.ok).toBe(true);
    expect(Array.isArray(list.body.projects)).toBe(true);
    expect(list.body.projects.some((p) => p.id === projectId)).toBe(true);

    // GET (тут data должна быть)
    const got = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(got.status).toBe(200);
    expect(got.body.ok).toBe(true);
    expect(got.body.project.id).toBe(projectId);
    expect(got.body.project.data).toEqual(payload.data);

    // UPDATE
    const upd = await request(app)
      .put(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed", data: { hello: "world" } });

    expect(upd.status).toBe(200);
    expect(upd.body.ok).toBe(true);
    expect(upd.body.project.name).toBe("Renamed");

    // GET after update -> data обновилась
    const got2 = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(got2.status).toBe(200);
    expect(got2.body.project.data).toEqual({ hello: "world" });

    // DELETE
    const del = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // GET after delete -> 404
    const got3 = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(got3.status).toBe(404);
    expect(got3.body.ok).toBe(false);
  });

  it("projects: update/delete несуществующего проекта -> 404", async () => {
    const token = await registerAndGetToken("nf@test.com");
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const upd = await request(app)
      .put(`/api/projects/${fakeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X" });

    expect(upd.status).toBe(404);
    expect(upd.body.ok).toBe(false);

    const del = await request(app)
      .delete(`/api/projects/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(del.status).toBe(404);
    expect(del.body.ok).toBe(false);
  });

  it("projects: чужой проект недоступен (404)", async () => {
    const token1 = await registerAndGetToken("owner@test.com");
    const token2 = await registerAndGetToken("other@test.com");

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token1}`)
      .send({ name: "Private", data: { x: 1 } });

    const projectId = created.body.project.id;

    const чужой = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(чужой.status).toBe(404);
    expect(чужой.body.ok).toBe(false);
  });

  it("projects: list возвращает только свои проекты и сортирует по updatedAt desc", async () => {
    const tokenA = await registerAndGetToken(uniqEmail("a"));
    const tokenB = await registerAndGetToken(uniqEmail("b"));

    // user A: два проекта
    const p1 = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "A1", data: { a: 1 } });
    expect(p1.status).toBe(200);

    const p2 = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "A2", data: { a: 2 } });
    expect(p2.status).toBe(200);

    // user B: один проект
    const pb = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "B1", data: { b: 1 } });
    expect(pb.status).toBe(200);

    // обновим A1, чтобы он стал самым свежим
    await sleep(20);
    const upd = await request(app)
      .put(`/api/projects/${p1.body.project.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "A1-upd" });
    expect(upd.status).toBe(200);

    const listA = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(listA.status).toBe(200);
    expect(listA.body.ok).toBe(true);

    const idsA = listA.body.projects.map((x) => x.id);
    expect(idsA).toContain(p1.body.project.id);
    expect(idsA).toContain(p2.body.project.id);
    expect(idsA).not.toContain(pb.body.project.id); // чужой не попал

    // сортировка updatedAt desc: первый элемент должен быть обновлённый A1
    expect(listA.body.projects[0].id).toBe(p1.body.project.id);
  });
});
