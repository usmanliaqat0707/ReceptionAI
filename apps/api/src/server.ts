import path from "path";
import dotenv from "dotenv";

// Load environment variables from workspace root and apps/api
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { validateEnv } from "@receptionai/config";
import { logger } from "@receptionai/observability";
import { buildApp } from "./app";

// Validate environment variables at process bootstrap
validateEnv(process.env);

const port = Number(process.env.PORT || 4000);
const host = "0.0.0.0";

const app = buildApp();

async function start() {
  try {
    await app.listen({ port, host });
    logger.info(`🚀 ReceptionAI API backend running on http://${host}:${port}`);
    console.log(`🚀 ReceptionAI API backend running on http://${host}:${port}`);
  } catch (err) {
    logger.fatal({ err }, "Fatal error starting ReceptionAI API server");
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Gracefully shutting down ReceptionAI API...`);
  try {
    await app.close();
    logger.info("API server closed.");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
