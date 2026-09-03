/**
 * ReceptionAI Background Worker (Phase 3 Placeholder)
 *
 * This process will handle BullMQ / Redis-based asynchronous queues,
 * webhook retries, post-call audio transcription, and external notifications.
 */
export function getWorkerStatus() {
  return {
    status: "idle",
    phase: 3,
    component: "worker",
  };
}

if (process.env.NODE_ENV !== "test" && require.main === module) {
  console.log("ReceptionAI Background Worker stub initialized (Phase 3 readiness).");
}
