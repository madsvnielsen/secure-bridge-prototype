import WebSocket, { type RawData } from "ws";
import { IncomingMessage, ClientRequest } from "http";
import { clientConfig } from "./config";
import axios from "axios";
import https from "https";

export function initBridgeWs(apiBase: string) {
  const options = clientConfig();
  const { host, port, ...tlsOptions } = options;

  const url = `wss://${host}:${port}/ws`;
  console.log("Connecting to", url);

  const ws = new WebSocket(url, {
    key: tlsOptions.key,
    cert: tlsOptions.cert,
    ca: tlsOptions.ca,
    rejectUnauthorized: true,
    headers: {
      Host: host
    }
  });

  const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    key: tlsOptions.key,
    cert: tlsOptions.cert,
    ca: tlsOptions.ca,
  });

  const apiClient = axios.create({
    baseURL: apiBase,
    httpsAgent,
    timeout: 10_000,
  });

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

    if (msg.type !== "command") return;

    const {
      requestId,
      bridgeConfigurationId,
      command,
      payload,
    } = msg;

    // Dummy execution
    let success = true;
    let result: any = {
      echo: payload,
      dummy: "successful execution",
    };
    let error: string | null = null;

    try {
      // Execute command here
    } catch (err: any) {
      success = false;
      error = err.message;
      result = null;
    }

    // Send response to API
    try {
      await apiClient.post("/api/bridges/results", {
        requestId,
        bridgeConfigurationId,
        success,
        result,
        error,
      });

      console.log("Bridge sent result for", requestId);
    } catch (err: any) {
      console.error("FAILED to POST result to API:", err.message);
    }
  });


  ws.on("unexpected-response", (_req: ClientRequest, res: IncomingMessage) => {
    console.log("WSS unexpected-response, status =", res.statusCode);
  });

  ws.on("close", (code: number, data: RawData) => {
    const reason = data?.toString?.() || "";
    console.log("WSS CLOSED", code, reason);
    //initBridgeWs(); // Reconnect
  });

  ws.on("error", (err: Error) => {
    console.error("WSS ERROR:", err);
  });
}
