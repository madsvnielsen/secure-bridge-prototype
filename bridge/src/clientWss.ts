// src/client_wss.ts
import WebSocket, { type RawData } from "ws";
import { IncomingMessage, ClientRequest } from "http";
import { clientConfig } from "./config.ts";

export function initBridgeWs() {
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
  ws.on("open", () => {
    console.log("WSS OPEN");
    ws.send(
      JSON.stringify({
        hello: "bridge (mtls)",
        time: new Date().toISOString(),
      })
    );
  });

  ws.on("message", (data: RawData, isBinary: boolean) => {
    const msg = isBinary ? data : data.toString();
    console.log("WSS MESSAGE:", msg);
  });

  ws.on("unexpected-response", (_req: ClientRequest, res: IncomingMessage) => {
    console.log("WSS unexpected-response, status =", res.statusCode);
  });

  ws.on("close", (code: number, data: RawData) => {
    const reason = data?.toString?.() || "";
    console.log("WSS CLOSED", code, reason);
  });

  ws.on("error", (err: Error) => {
    console.error("WSS ERROR:", err);
  });
}
