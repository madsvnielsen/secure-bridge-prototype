import axios from "axios";
import WebSocket from "ws";
import fs from "fs";
import https from "https";
import express from "express";
import path from "path";
import crypto from "crypto";
import forge from "node-forge";
import { initBridgeWs } from "./clientWss.ts";
import { bridgeStatusHtml } from "./pages/bridgeStatus.ts";
import { ClientRequest, IncomingMessage } from "http";
import { getToken } from "./tokenHandler.ts";
import { apiClientConfig, clientConfig } from "./config.ts";


const apiBase = "https://api.hococo.internal/api";

const BRIDGE_API_CA_PATH = process.env.BRIDGE_API_CA_PATH || "/etc/hococo/bridge-api-ca.pem";

const ca = fs.readFileSync(BRIDGE_API_CA_PATH);
const httpsAgent = new https.Agent({ ca });

const BRIDGE_STATE_DIR = process.env.BRIDGE_STATE_DIR || "/var/lib/hococo-bridge";

if (!fs.existsSync(BRIDGE_STATE_DIR)) {
  fs.mkdirSync(BRIDGE_STATE_DIR, { recursive: true });
  try {
    fs.chmodSync(BRIDGE_STATE_DIR, 0o700);
  } catch {
    // ignore 
  }
}

const BRIDGE_KEY_PATH = path.join(BRIDGE_STATE_DIR, "bridge.key.pem");
const BRIDGE_CSR_PATH = path.join(BRIDGE_STATE_DIR, "bridge.csr.pem");
const DEVICE_CERT_CHAIN_PATH = path.join(BRIDGE_STATE_DIR, "bridge-device-chain.pem");
const CA_BUNDLE_PATH = path.join(BRIDGE_STATE_DIR, "bridge-ca-bundle.pem");
const BRIDGE_SETTINGS_PATH = path.join(BRIDGE_STATE_DIR, "bridge-settings.json");

let lastPairingTxId: string | null = null;

function generatePairingCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

function ensureBridgeKeyAndCsr(commonName: string) {
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

const app = express();
app.use(express.json());

app.get("/bridge/status", (_req, res) => {
  res.type("html").send(bridgeStatusHtml);
});


// ---- Pairing-init endpoint with CSR + pairing code ----
app.post("/bridge/pair/init", async (_req: any, res: any) => {
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
      { httpsAgent, timeout: 5000 }
    );

    lastPairingTxId = apiResponse.data.pairingTxId;

    res.status(apiResponse.status).json({
      pairingCode,
      pairingTxId: apiResponse.data.pairingTxId,
      status: apiResponse.data.status,
      expiresAt: apiResponse.data.expiresAt,
    });
  } catch (err: any) {
    console.error("Error calling API /bridges/pair/start from Bridge:", err.message);
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

app.get("/bridge/pair/status", async (req, res) => {
  try {
    const pairingTxId =
      (req.query.pairingTxId) || lastPairingTxId;

    if (!pairingTxId) {
      return res.status(400).json({
        error: "missing_pairingTxId",
        message: "pairingTxId is required",
      });
    }

    const r = await axios.get(`${apiBase}/bridges/pair/status`, {
      httpsAgent,
      params: { pairingTxId },
      timeout: 5000,
    });

    res.status(r.status).json(r.data);
  } catch (err: any) {
    console.error("Error calling API /bridges/pair/status from Bridge:", err.message);
    res.status(500).json({
      error: "bridge_pair_status_failed",
      message: err.message,
    });
  }
});

app.post("/bridge/pair/finalize", async (req, res) => {
  try {
    const pairingTxId =
      (req.body?.pairingTxId) || lastPairingTxId;

    if (!pairingTxId) {
      return res.status(400).json({
        error: "missing_pairingTxId",
        message: "pairingTxId is required",
      });
    }

    const r = await axios.post(
      `${apiBase}/bridges/pair/finalize`,
      { pairingTxId },
      { httpsAgent, timeout: 5000 }
    );

    const data = r.data;

    if (!data.deviceCertificateChainPem || !data.caBundlePem) {
      console.warn("Finalize response missing certificate fields:", Object.keys(data));
    } else {
      if (!fs.existsSync(BRIDGE_STATE_DIR)) {
        fs.mkdirSync(BRIDGE_STATE_DIR, { recursive: true });
      }

      [DEVICE_CERT_CHAIN_PATH, CA_BUNDLE_PATH, BRIDGE_SETTINGS_PATH].forEach((p) => {
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch (e) {
            console.warn("Failed to delete existing file", p, e);
          }
        }
      });

      // Write new cert chain
      fs.writeFileSync(
        DEVICE_CERT_CHAIN_PATH,
        data.deviceCertificateChainPem,
        { encoding: "utf8", mode: 0o600 }
      );

      // Write new CA bundle
      fs.writeFileSync(
        CA_BUNDLE_PATH,
        data.caBundlePem,
        { encoding: "utf8", mode: 0o600 }
      );

      // Persist URLs & metadata
      const settings = {
        pairingTxId,
        bridgeConfigurationId: data.bridgeConfigurationId ?? null,
        wssUrl: data.wssUrl ?? null,
        apiBaseUrl: data.apiBaseUrl ?? null,
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(
        BRIDGE_SETTINGS_PATH,
        JSON.stringify(settings, null, 2),
        { encoding: "utf8", mode: 0o600 }
      );

      console.log("Persisted bridge certs & settings to /data:");
      console.log(" -", DEVICE_CERT_CHAIN_PATH);
      console.log(" -", CA_BUNDLE_PATH);
      console.log(" -", BRIDGE_SETTINGS_PATH);
    }

    // Pass API response through to the caller
    res.status(r.status).json(data);
    initBridgeWs();
    getToken(data.bridgeConfigurationId, apiClientConfig(), apiBase);
  } catch (err: any) {
    console.error(
      "Error calling API /bridges/pair/finalize from Bridge:",
      err.message
    );
    res.status(500).json({
      error: "bridge_pair_finalize_failed",
      message: err.message,
    });
  }
});