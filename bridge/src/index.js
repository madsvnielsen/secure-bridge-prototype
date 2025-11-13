import axios from "axios";
import WebSocket from "ws";
import fs from "fs";
import https from "https";
import express from "express";
import path from "path";
import crypto from "crypto";
import forge from "node-forge";

const apiBase = "https://api.hococo.internal/api";
const wsUrl = "wss://ws.hococo.internal/ws";

const ca = fs.readFileSync("/etc/ssl/certs/hococo_ca.crt");
const httpsAgent = new https.Agent({ ca });

const DATA_DIR = "/data";
const BRIDGE_KEY_PATH = path.join(DATA_DIR, "bridge.key.pem");
const BRIDGE_CSR_PATH = path.join(DATA_DIR, "bridge.csr.pem");

// Make sure /data exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generatePairingCode() {
  const n = crypto.randomInt(0, 1_000_000); 
  return n.toString().padStart(6, "0");
}

function ensureBridgeKeyAndCsr(commonName) {
  if (fs.existsSync(BRIDGE_KEY_PATH) && fs.existsSync(BRIDGE_CSR_PATH)) {
    const csrPem = fs.readFileSync(BRIDGE_CSR_PATH, "utf8");
    const keyPem = fs.readFileSync(BRIDGE_KEY_PATH, "utf8");
    return { csrPem, keyPem };
  }

  console.log("Generating new bridge keypair + CSR…");

  const keys = forge.pki.rsa.generateKeyPair(2048);

  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    {
      name: "commonName",
      value: commonName,
    },
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());

  if (!csr.verify()) {
    throw new Error("Generated CSR failed self verification");
  }

  const csrPem = forge.pki.certificationRequestToPem(csr);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

  fs.writeFileSync(BRIDGE_KEY_PATH, keyPem, { encoding: "utf8", mode: 0o600 });
  fs.writeFileSync(BRIDGE_CSR_PATH, csrPem, { encoding: "utf8", mode: 0o600 });

  console.log("Bridge key + CSR written to", BRIDGE_KEY_PATH, "and", BRIDGE_CSR_PATH);

  return { csrPem, keyPem };
}

async function tick() {
  try {
    const r = await axios.get(`${apiBase}/health`, {
      timeout: 3000,
      httpsAgent,
    });
    console.log("api health", r.data);
  } catch (e) {
    console.log("api fail", e.message);
  }

  const ws = new WebSocket(wsUrl, { ca });

  ws.on("open", () => {
    console.log("ws open");
    ws.send(JSON.stringify({ hello: "bridge" }));
  });
  ws.on("message", (m) => console.log("ws", m.toString()));
  ws.on("close", () => console.log("ws closed"));
  ws.on("error", (err) => console.log("ws error", err.message));
}

tick();
setInterval(tick, 15000);

const app = express();
app.use(express.json());

app.get("/bridge/status", (_req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8" /><title>Bridge Status</title></head>
      <body>
        <h1>Bridge Status</h1>
        <button id="pairBtn">Init pairing</button>
        <pre id="output"></pre>
        <script>
          const btn = document.getElementById("pairBtn");
          const out = document.getElementById("output");
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            out.textContent = "Calling /bridge/pair/init on this Bridge...";
            try {
              const res = await fetch("/bridge/pair/init", { method: "POST" });
              const data = await res.json();
              out.textContent = JSON.stringify(data, null, 2);
            } catch (err) {
              out.textContent = "Error: " + err.message;
            } finally {
              btn.disabled = false;
            }
          });
        </script>
      </body>
    </html>
  `);
});

// ---- Pairing-init endpoint with CSR + pairing code ----
app.post("/bridge/pair/init", async (_req, res) => {
  try {
    const bridgeIdentifier = "bridge-prototype-1";
    const { csrPem } = ensureBridgeKeyAndCsr(bridgeIdentifier);

    const pairingCode = generatePairingCode();
    console.log("Generated pairing code:", pairingCode);

    const apiResponse = await axios.post(
      `${apiBase}/bridges/pair/start`,
      {
        bridgeIdentifier,
        pairingCode,
        csr: csrPem,
      },
      {
        httpsAgent,
        timeout: 5000,
      }
    );

    res.status(apiResponse.status).json({
      pairingCode,
      apiResponse: apiResponse.data,
    });
  } catch (err) {
    console.error("Error calling API /bridges/pair/init from Bridge:", err.message);
    res.status(500).json({
      error: "bridge_pair_init_failed",
      message: err.message,
    });
  }
});

const port = process.env.BRIDGE_HTTP_PORT || 8080;
app.listen(port, () => {
  console.log("Bridge HTTP server listening on port", port);
});
