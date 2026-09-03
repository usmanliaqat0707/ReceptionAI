import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import { redis } from "../../lib/redis";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", async (_req, reply) => {
    let dbStatus = "ok";
    let redisStatus = "ok";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    try {
      await redis.ping();
    } catch {
      redisStatus = "error";
    }

    const isHealthy = dbStatus === "ok" && redisStatus === "ok";
    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database: dbStatus,
        redis: redisStatus,
      },
    });
  });
}
