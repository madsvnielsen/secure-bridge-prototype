import http from "http";
import { WebSocketServer } from "ws";
import { Certificate } from "@fidm/x509";
import { getClientRoleFromCert } from "./certUtils.ts";

// Map bridgeIdentity -> WebSocket
// bridgeIdentity will be SAN "bridge:<id>"
const bridgeConnections = new Map<string, import("ws").WebSocket>();

/**
 * $ssl_client_escaped_cert in nginx URL-encoded and flattened. This function restores the PEM format.
 */
function normalizePem(flatPem?: string | string[]): string | null {
  if (!flatPem) return null;
  const raw = Array.isArray(flatPem) ? flatPem.join("") : String(flatPem);

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch (e) {
    console.warn("Failed to decode ssl-client-cert header:", e);
    return null;
  }

  let cleaned = decoded
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  // Insert break every 64 characters
  const lines = cleaned.match(/.{1,64}/g) || [];

  return (
    "-----BEGIN CERTIFICATE-----\n" +
    lines.join("\n") +
    "\n-----END CERTIFICATE-----\n"
  );
}

/**
 * Extract bridgeConfigurationId from a URI SAN of the form:
 *   URI:bridge:<id>
 */
function extractBridgeConfigurationIdFromCert(pem: string): string | null {
  const cert = Certificate.fromPEM(Buffer.from(pem));

  const sanExt = cert.extensions.find((ext) => ext.name === "subjectAltName");
  if (!sanExt || !sanExt.altNames) return null;

  for (const alt of sanExt.altNames) {
    // type 6 = URI SAN
    if (alt.type === 6 && typeof alt.value === "string") {
      if (alt.value.startsWith("bridge:")) {
        return alt.value.substring("bridge:".length);
      }
    }
  }

  return null;
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/admin/ws/bridges/disconnect") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString("utf8")));
    req.on("end", () => {
      try {
        const rawCertHeader = req.headers["ssl-client-cert"];
        const pem = normalizePem(rawCertHeader as string | string[]);
        if (!pem) {
          res.statusCode = 401;
          return res.end("Missing or invalid client cert");
        }

        const role = getClientRoleFromCert(pem);
        if (role.type !== "api") {
          res.statusCode = 403;
          return res.end("Forbidden: only API client is allowed");
        }

        const payload = JSON.parse(body || "{}");
        const bridgeId = String(payload.bridgeConfigurationId || "").trim();
        if (!bridgeId) {
          res.statusCode = 400;
          return res.end("Missing bridgeConfigurationId");
        }

        const socket = bridgeConnections.get(bridgeId);
        if (!socket) {
          console.log("No active WS connection for bridge", bridgeId);
          res.statusCode = 204;
          return res.end();
        }

        console.log("Closing WS connection for revoked bridge", bridgeId);
        bridgeConnections.delete(bridgeId);
        socket.close(4001, "Bridge certificate revoked");

        res.statusCode = 204;
        return res.end();
      } catch (err: any) {
        console.error("Admin disconnect error:", err);
        res.statusCode = 500;
        return res.end("Internal error");
      }
    });
    return;
  }

   if (req.method === "POST" && req.url === "/admin/ws/bridges/command") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString("utf8")));
    req.on("end", () => {
      try {
        const rawCertHeader = req.headers["ssl-client-cert"];
        const pem = normalizePem(rawCertHeader as string | string[]);
        if (!pem) {
          res.statusCode = 401;
          return res.end("Missing or invalid client cert");
        }

        const role = getClientRoleFromCert(pem);
        if (role.type !== "api") {
          res.statusCode = 403;
          return res.end("Forbidden: only API client is allowed");
        }

        const payload = JSON.parse(body || "{}");
        const bridgeId  = String(payload.bridgeConfigurationId || "").trim();
        const command   = String(payload.command || "").trim();
        const cmdType   = (payload.type && String(payload.type)) || "command";
        const cmdBody   = payload.payload ?? null;
        const requestId = payload.requestId || null;

        if (!bridgeId || !command) {
          res.statusCode = 400;
          return res.end("Missing bridgeConfigurationId or command");
        }

        const socket = bridgeConnections.get(bridgeId);
        if (!socket || socket.readyState !== socket.OPEN) {
          console.log("No active WS connection for bridge", bridgeId);
          res.statusCode = 404;
          return res.end("No active bridge connection");
        }

        const msg = {
          type: cmdType,
          command,
          requestId,
          payload: cmdBody,
          sentAt: new Date().toISOString(),
          from: "server",
        };

        console.log("Sending command to bridge", bridgeId, ":", msg);
        socket.send(JSON.stringify(msg));

        res.statusCode = 202;
        return res.end("Command dispatched");
      } catch (err: any) {
        console.error("Admin command error:", err);
        res.statusCode = 500;
        return res.end("Internal error");
      }
    });
    return;
  }

  console.log("HTTP request on WS server:", req.method, req.url);
  res.statusCode = 400;
  res.setHeader("Content-Type", "text/plain");
  res.end("Expected WebSocket upgrade or admin call\n");
});

// Called when an upgrade request is received.
server.on("upgrade", (req, _socket, _head) => {
  console.log("HTTP upgrade on WS server:", req.url, req.headers.upgrade);
});


const wss = new WebSocketServer({ server });

// WSS connection handler
wss.on("connection", (socket, req) => {
  console.log("WS connection accepted from", req.socket.remoteAddress, "url =", req.url);

  try {
    const rawCertHeader = req.headers["ssl-client-cert"];
    const subjectDnHeader = req.headers["ssl-client-subject-dn"];
    const issuerDnHeader = req.headers["ssl-client-issuer-dn"];

    const subjectDn = subjectDnHeader ? String(subjectDnHeader) : "";
    const issuerDn = issuerDnHeader ? String(issuerDnHeader) : "";

    const pem = normalizePem(rawCertHeader as string | string[]);
    if (!pem) {
      console.warn("Could not reconstruct PEM from ssl-client-cert header");
      socket.close(1008, "Invalid certificate");
      return;
    }

    const role = getClientRoleFromCert(pem);

    if (role.type === "bridge") {
      const identity = role.bridgeId;
      console.log("Bridge connected. bridgeId =", identity);

      bridgeConnections.set(identity, socket as any);

      (socket as any).bridgeIdentity = identity;
      (socket as any).bridgeSubjectDn = subjectDn;
      (socket as any).bridgeIssuerDn = issuerDn;

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
        console.log("Bridge disconnected:", identity, "code:", code, "reason:", reason?.toString?.() ?? "");
        const current = bridgeConnections.get(identity);
        if (current === socket) {
          bridgeConnections.delete(identity);
        }
      });

      socket.on("error", (err) => {
        console.error("WS error for bridge", identity, ":", err.message);
      });

      return;
    }

    if (role.type === "api") {
      console.log("API tried to open /ws WebSocket");
      socket.close(1008, "API WS not supported on /ws");
      return;
    }

    console.warn("Unknown client role: no SAN bridge or or api in client cert");
    socket.close(1008, "Unknown client identity");
  } catch (err) {
    console.error("Fatal error during WS connection init:", err);
    socket.close(1011, "Internal error");
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("WSS listening on", PORT);
});
