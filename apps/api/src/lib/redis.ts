import Redis from "ioredis";
import { logger } from "@receptionai/observability";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6380";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 100, 2000);
  },
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.warn({ err }, "Redis connection warning (non-fatal)");
});
