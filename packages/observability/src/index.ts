import pino, { Logger } from "pino";

// Secret keys that must never appear in production log traces
const REDACT_PATHS = [
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "secret",
  "secretHash",
  "cookie",
  "headers.cookie",
  "headers.authorization",
  "req.headers.cookie",
  "req.headers.authorization",
];

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createRequestLogger(context: {
  requestId: string;
  workspaceId?: string;
  userId?: string;
}): Logger {
  return logger.child(context);
}
