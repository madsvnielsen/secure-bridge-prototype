import http from "http";
import { WebSocketServer } from "ws";
import { Certificate } from "@fidm/x509";

// Map bridgeIdentity -> WebSocket
// bridgeIdentity will be SAN "bridge:<id>"
const bridgeConnections = new Map<string, import("ws").WebSocket>();

/**
 * Take the escaped PEM coming from NGINX's $ssl_client_escaped_cert
 * and normalize it into a proper multi-line PEM block.
 * $ssl_client_escaped_cert is URL-encoded, so we should decode it first.
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

// Logging of HTTP requests without upgrade header.
const server = http.createServer((req, res) => {
  console.log("HTTP request on WS server:", req.method, req.url);
  res.statusCode = 400;
  res.setHeader("Content-Type", "text/plain");
  res.end("Expected WebSocket upgrade\n");
});

// Called when an upgrade request is received.
server.on("upgrade", (req, _socket, _head) => {
  console.log("HTTP upgrade on WS server:", req.url, req.headers.upgrade);
});


const wss = new WebSocketServer({ server });

// WSS connection handler
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

    const subjectDn = subjectDnHeader ? String(subjectDnHeader) : "";
    const issuerDn = issuerDnHeader ? String(issuerDnHeader) : "";

    console.log("New WS connection from", req.socket.remoteAddress);
    console.log("Client subject DN:", subjectDn || "<missing>");
    console.log("Client issuer  DN:", issuerDn || "<missing>");
    console.log(
      "Client cert header preview:\n" +
        (rawCertHeader ? String(rawCertHeader).slice(0, 120) : "null")
    );

    // 1) nginx reverse proxy already did mTLS verification, so we can trust the cert.

    // 2) Reconstruct PEM from escaped header passed from nginx
    const pem = normalizePem(rawCertHeader as string | string[]);
    if (!pem) {
      console.warn("Could not reconstruct PEM from ssl-client-cert header");
      socket.close(1008, "Invalid certificate");
      return;
    }

    // 3) Try SAN-based bridgeConfigurationId
    const sanBridgeId = extractBridgeConfigurationIdFromCert(pem);

    // 4) Fallback identity is subject DND
    const identity = sanBridgeId || subjectDn;

    if (!identity) {
      console.warn("No usable identity (SAN bridge: or subject DN) in client cert");
      socket.close(1008, "Missing bridge identity");
      return;
    }

    console.log(
      "Bridge connected. identity =",
      identity,
      sanBridgeId ? `(SAN bridge:${sanBridgeId})` : "(using subject DN)"
    );

    // Track this bridge connection
    bridgeConnections.set(identity, socket as any);

    // Attach metadata to socket for later use
    (socket as any).bridgeIdentity = identity;
    (socket as any).bridgeSubjectDn = subjectDn;
    (socket as any).bridgeIssuerDn = issuerDn;

    // --- Message handling ---
    socket.on("message", (data: any) => {
      const text = data.toString();
      console.log("WS msg from", identity, ":", text);

      socket.send(
        JSON.stringify({
          from: "wss",
          bridgeIdentity: identity,
          subjectDn,
          echo: text,
        })
      );
    });

    socket.on("close", (code: any, reason: any) => {
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

    socket.on("error", (err: any) => {
      console.error("WS error for", identity, ":", err.message);
    });
  } catch (err) {
    console.error("Fatal error during WS connection init:", err);
    socket.close(1011, "Internal error");
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("WSS listening on", PORT);
});
