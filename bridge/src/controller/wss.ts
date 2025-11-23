import { type RawData } from "ws";
import { IncomingMessage, ClientRequest } from "http";
import { buildHttpsClient, BuildWssClient } from "../config/config";
import { BridgeSettings } from "../config/settings";
import { executeCommand } from "./commandExecutor";

export function initBridgeWs(settings: BridgeSettings) {
  const apiClient = buildHttpsClient();
  const ws = BuildWssClient();

  ws.on("open", () => {
    console.log("WSS OPEN");
    ws.send(
      JSON.stringify({
        hello: "bridge",
        time: new Date().toISOString(),
      })
    );
  });

  ws.on("message", async (data: RawData, isBinary: boolean) => {
    const raw = isBinary ? data.toString() : data.toString();

    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.error("Invalid JSON from WSS:", e);
      return;
    }

    if (msg.type === "command") {
      executeCommand(msg, apiClient, settings);
      return;
    }

    return;
  });

  ws.on("unexpected-response", (_req: ClientRequest, res: IncomingMessage) => {
    console.log("WSS unexpected-response, status =", res.statusCode);
  });

  ws.on("close", (code: number, data: RawData) => {
    const reason = data?.toString?.() || "";
    console.log("WSS CLOSED", code, reason);
    initBridgeWs(settings); // Reconnect
  });

  ws.on("error", (err: Error) => {
    console.error("WSS ERROR:", err);
  });
}
