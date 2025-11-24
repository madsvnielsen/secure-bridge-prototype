import http, { IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Certificate } from "@fidm/x509";
import { getClientRoleFromCert } from "./certUtils.ts";

const bridgeConnections = new Map<string, WebSocket>();

type ClientRole =
  | { type: "bridge"; bridgeId: string }
  | { type: "api" };

interface BridgeWebSocket extends WebSocket {
  bridgeIdentity?: string;
  bridgeSubjectDn?: string;
  bridgeIssuerDn?: string;
} 

function normalizePem(flatPem?: string | string[]): string | null {
  if (!flatPem) return null;
  const raw = Array.isArray(flatPem) ? flatPem.join("") : String(flatPem);

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch (error) {
    console.warn("Failed to decode ssl-client-cert header:", error);
    return null;
  }

  const cleaned = decoded
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  const lines = cleaned.match(/.{1,64}/g) ?? [];
  return [
    "-----BEGIN CERTIFICATE-----",
    ...lines,
    "-----END CERTIFICATE-----",
    "",
  ].join("\n");
}

export function extractBridgeConfigurationIdFromCert(pem: string): string | null {
  const cert = Certificate.fromPEM(Buffer.from(pem));
  const sanExt = cert.extensions.find((ext) => ext.name === "subjectAltName");
  if (!sanExt || !sanExt.altNames) return null;

  for (const alt of sanExt.altNames) {
    // type 6 = URI SAN
    if (alt.type === 6 && typeof alt.value === "string" && alt.value.startsWith("bridge:")) {
      return alt.value.substring("bridge:".length);
    }
  }

  return null;
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => resolve(body));
    req.on("error", (err) => reject(err));
  });
}

function authenticateApiClient(
  req: IncomingMessage,
  res: ServerResponse
): string | null {
  const rawCertHeader = req.headers["ssl-client-cert"];
  const pem = normalizePem(rawCertHeader as string | string[] | undefined);

  if (!pem) {
    res.statusCode = 401;
    res.end("Missing or invalid client cert");
    return null;
  }

  const role = getClientRoleFromCert(pem) as ClientRole;
  if (role.type !== "api") {
    res.statusCode = 403;
    res.end("Forbidden: only API client is allowed");
    return null;
  }

  return pem;
}

interface AdminBridgeDisconnectPayload {
  bridgeConfigurationId?: string;
}

interface AdminBridgeCommandPayload {
  bridgeConfigurationId?: string;
  command?: string;
  type?: string;
  payload?: unknown;
  requestId?: string;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/admin/ws/bridges/disconnect") {
      const pem = authenticateApiClient(req, res);
      if (!pem) return;

      const body = await readRequestBody(req);
      const payload: AdminBridgeDisconnectPayload = JSON.parse(body || "{}");
      const bridgeId = payload.bridgeConfigurationId?.trim();

      if (!bridgeId) {
        res.statusCode = 400;
        res.end("Missing bridgeConfigurationId");
        return;
      }

      const socket = bridgeConnections.get(bridgeId);
      if (!socket) {
        console.log("No active WS connection for bridge", bridgeId);
        res.statusCode = 204;
        res.end();
        return;
      }

      console.log("Closing WS connection for revoked bridge", bridgeId);
      bridgeConnections.delete(bridgeId);
      socket.close(4001, "Bridge certificate revoked");

      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/admin/ws/bridges/command") {
      const pem = authenticateApiClient(req, res);
      if (!pem) return;

      const body = await readRequestBody(req);
      const payload: AdminBridgeCommandPayload = JSON.parse(body || "{}");

      const bridgeId = payload.bridgeConfigurationId?.trim();
      const command = payload.command?.trim();
      const cmdType = payload.type?.toString() ?? "command";
      const cmdBody = payload.payload ?? null;
      const requestId = payload.requestId ?? null;

      if (!bridgeId || !command) {
        res.statusCode = 400;
        res.end("Missing bridgeConfigurationId or command");
        return;
      }

      const socket = bridgeConnections.get(bridgeId);
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log("No active WS connection for bridge", bridgeId);
        res.statusCode = 404;
        res.end("No active bridge connection");
        return;
      }

      const msg = {
        type: cmdType,
        command,
        requestId,
        payload: cmdBody,
        sentAt: new Date().toISOString(),
        from: "server" as const,
      };

      console.log("Sending command to bridge", bridgeId, ":", msg);
      socket.send(JSON.stringify(msg));

      res.statusCode = 202;
      res.end("Command dispatched");
      return;
    }

    console.log("HTTP request on WS server:", req.method, req.url);
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Expected WebSocket upgrade or admin call\n");
  } catch (error) {
    console.error("HTTP handler error:", error);
    res.statusCode = 500;
    res.end("Internal error");
  }
});

server.on("upgrade", (req, _socket, _head) => {
  console.log("HTTP upgrade on WS server:", req.url, req.headers.upgrade);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, req) => {
  console.log(
    "WS connection accepted from",
    req.socket.remoteAddress,
    "url =",
    req.url
  );

  try {
    const rawCertHeader = req.headers["ssl-client-cert"];
    const subjectDnHeader = req.headers["ssl-client-subject-dn"];
    const issuerDnHeader = req.headers["ssl-client-issuer-dn"];

    const subjectDn = String(subjectDnHeader);
    const issuerDn = String(subjectDnHeader);

    const pem = normalizePem(rawCertHeader);
    
    if (!pem) {
      console.warn("Could not reconstruct PEM from ssl-client-cert header");
      socket.close(1008, "Invalid certificate");
      return;
    }

    const role = getClientRoleFromCert(pem) as ClientRole;

    if (role.type === "bridge") {
      const identity = role.bridgeId;
      console.log("Bridge connected. bridgeId =", identity);

      bridgeConnections.set(identity, socket);
      (socket as BridgeWebSocket).bridgeIdentity = identity;
      (socket as BridgeWebSocket).bridgeSubjectDn = subjectDn;
      (socket as BridgeWebSocket).bridgeIssuerDn = issuerDn;

      socket.on("message", (data) => {
        const text = data.toString();
        console.log("WS msg from bridge", identity, ":", text);

        socket.send(
          JSON.stringify({
            from: "wss",
            bridgeIdentity: identity,
            subjectDn,
            echo: text,
          })
        );
      });

      socket.on("close", (code, reason) => {
        console.log(
          "Bridge disconnected:",
          identity,
          "code:",
          code,
          "reason:",
          reason?.toString?.() ?? ""
        );
        const current = bridgeConnections.get(identity);
        if (current === socket) {
          bridgeConnections.delete(identity);
        }
      });

      socket.on("error", (err) => {
        console.error("WS error for bridge", identity, ":", (err as Error).message);
      });

      return;
    }

    if (role.type === "api") {
      console.log("API tried to open /ws WebSocket");
      socket.close(1008, "API WS not supported on /ws");
      return;
    }

    console.warn("Unknown client role: no SAN bridge or api in client cert");
    socket.close(1008, "Unknown client identity");
  } catch (error) {
    console.error("Fatal error during WS connection init:", error);
    socket.close(1011, "Internal error");
  }
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
  console.log("WSS listening on", PORT);
});
