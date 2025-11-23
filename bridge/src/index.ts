import { startBridge } from "./bridge.ts";

startBridge().catch((err) => {
  console.error("[Bridge] Fatal error on startup:", err);
  process.exit(1);
});
