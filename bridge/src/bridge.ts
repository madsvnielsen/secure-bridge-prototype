import fs from "fs";
import https from "https";
import express from "express";
import { registerPairingRoutes } from "./pairingRoutes";
import { bootstrapExistingBridge, ensureBridgeStateDir, loadBridgeSettings } from "./bridgeStartup";
import { getCurrentToken } from "./tokenStore";
import { renderBridgeStatus } from "./pages/renderBridgeStatus";

const apiBase = "https://api.hococo.internal/api";

const BRIDGE_API_CA_PATH =
  process.env.BRIDGE_API_CA_PATH || "/etc/hococo/bridge-api-ca.pem";

export async function startBridge() {
  ensureBridgeStateDir();

  const ca = fs.readFileSync(BRIDGE_API_CA_PATH);
  const httpsAgent = new https.Agent({ ca });

  const app = express();
  app.use(express.json());

  app.get("/bridge/status", (_req, res) => {
    const settings = loadBridgeSettings();
    const token = getCurrentToken();
    const html = renderBridgeStatus({ settings, token });
    res.type("html").send(html);
  });

  registerPairingRoutes(app, { apiBase, httpsAgent });

  const port = process.env.BRIDGE_HTTP_PORT || 8080;
  app.listen(port, () => {
    console.log("Bridge HTTP server listening on port", port);
    void bootstrapExistingBridge(apiBase);
  });
}
