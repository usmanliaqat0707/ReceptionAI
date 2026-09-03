import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app";
import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import { SESSION_COOKIE_NAME } from "@receptionai/config";

describe("Phase 1 Authentication Integration Tests", () => {
  let app: FastifyInstance;
  const testEmail = `test_${Date.now()}@receptionai.test`;
  const testPassword = "Password123!";
  let sessionCookie = "";

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test records
    await prisma.user.deleteMany({
      where: { email: { contains: "@receptionai.test" } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("POST /api/v1/auth/signup - should register a new user and return httpOnly session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        name: "Test Engineer",
        email: testEmail,
        password: testPassword,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.user.name).toBe("Test Engineer");
    expect(body.data.user.passwordHash).toBeUndefined(); // Never leak password hash!

    // Verify session cookie was set
    const cookies = res.cookies;
    const cookie = cookies.find((c) => c.name === SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    sessionCookie = `${cookie?.name}=${cookie?.value}`;

    // Verify in database that session token is hashed
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeDefined();
    const session = await prisma.session.findFirst({ where: { userId: user!.id } });
    expect(session).toBeDefined();
    expect(session!.tokenHash).not.toBe(cookie?.value); // Stored as SHA-256 hash!
  });

  it("POST /api/v1/auth/login - should fail with 401 for incorrect credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: "WrongPassword!",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /api/v1/auth/me - should return current profile when authenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.user.email).toBe(testEmail);
  });

  it("POST /api/v1/auth/logout - should revoke the session in database and clear cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(res.statusCode).toBe(200);

    // Attempting to access protected route with revoked cookie should now return 401
    const checkRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(checkRes.statusCode).toBe(401);
  });
});
