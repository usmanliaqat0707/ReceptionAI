/**
 * ReceptionAI Realtime Voice Gateway (Phase 3 Placeholder)
 *
 * This process will manage WebRTC / WebSocket realtime audio streaming
 * and bi-directional OpenAI Realtime Voice sessions in Phase 3.
 */
export function getGatewayStatus() {
  return {
    status: "idle",
    phase: 3,
    component: "realtime-gateway",
  };
}

if (process.env.NODE_ENV !== "test" && require.main === module) {
  console.log("ReceptionAI Realtime Voice Gateway stub initialized (Phase 3 readiness).");
}
