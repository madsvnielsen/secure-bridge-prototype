import express from "express";
import axios from "axios";
import https from "https";
import fs from "fs";
import crypto from "crypto";
import forge from "node-forge";
import path from "path";
import {
  BRIDGE_STATE_DIR,
  DEVICE_CERT_CHAIN_PATH,
  CA_BUNDLE_PATH,
  BRIDGE_SETTINGS_PATH,
  saveBridgeSettings,
  BridgeSettings,
  bootstrapExistingBridge,
} from "./bridgeStartup";

export function registerPairingRoutes(app: express.Express, options: {
  apiBase: string;
  httpsAgent: https.Agent;
}) {
  const { apiBase, httpsAgent } = options;

  let lastPairingTxId: string | null = null;

  const BRIDGE_KEY_PATH = path.join(BRIDGE_STATE_DIR, "bridge.key.pem");
  const BRIDGE_CSR_PATH = path.join(BRIDGE_STATE_DIR, "bridge.csr.pem");

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

    console.log(
      "Bridge key + CSR written to",
      BRIDGE_KEY_PATH,
      "and",
      BRIDGE_CSR_PATH
    );

    return { csrPem, keyPem };
  }

  // ---- Pairing-init endpoint ----
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
      console.error(
        "Error calling API /bridges/pair/start from Bridge:",
        err.message
      );
      res.status(500).json({
        error: "bridge_pair_init_failed",
        message: err.message,
      });
    }
  });

  // ---- Pairing-status endpoint ----
  app.get("/bridge/pair/status", async (req, res) => {
    try {
      const pairingTxId =
        (req.query.pairingTxId as string) || lastPairingTxId;

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
      console.error(
        "Error calling API /bridges/pair/status from Bridge:",
        err.message
      );
      res.status(500).json({
        error: "bridge_pair_status_failed",
        message: err.message,
      });
    }
  });

  // ---- Pairing-finalize endpoint ----
  app.post("/bridge/pair/finalize", async (req, res) => {
    try {
      const pairingTxId = req.body?.pairingTxId || lastPairingTxId;

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
        console.warn(
          "Finalize response missing certificate fields:",
          Object.keys(data)
        );
      } else {
        if (!fs.existsSync(BRIDGE_STATE_DIR)) {
          fs.mkdirSync(BRIDGE_STATE_DIR, { recursive: true });
        }

        [DEVICE_CERT_CHAIN_PATH, CA_BUNDLE_PATH, BRIDGE_SETTINGS_PATH].forEach(
          (p) => {
            if (fs.existsSync(p)) {
              try {
                fs.unlinkSync(p);
              } catch (e) {
                console.warn("Failed to delete existing file", p, e);
              }
            }
          }
        );

        fs.writeFileSync(
          DEVICE_CERT_CHAIN_PATH,
          data.deviceCertificateChainPem,
          {
            encoding: "utf8",
            mode: 0o600,
          }
        );

        fs.writeFileSync(CA_BUNDLE_PATH, data.caBundlePem, {
          encoding: "utf8",
          mode: 0o600,
        });

        const settings: BridgeSettings = {
          pairingTxId,
          bridgeConfigurationId: data.bridgeConfigurationId ?? null,
          wssUrl: data.wssUrl ?? null,
          apiBaseUrl: data.apiBaseUrl ?? null,
          updatedAt: new Date().toISOString(),
        };

        saveBridgeSettings(settings);

        console.log("Persisted bridge certs & settings to /data:");
        console.log(" -", DEVICE_CERT_CHAIN_PATH);
        console.log(" -", CA_BUNDLE_PATH);
        console.log(" -", BRIDGE_SETTINGS_PATH);
      }

      // Use new certs & settings immediately
      void bootstrapExistingBridge(apiBase);

      res.status(r.status).json(data);
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
}
