import fs from "fs";
import path from "path";
import { apiClientConfig } from "./config.ts";
import { getToken } from "./tokenHandler.ts";
import { storeTokenFromResponse } from "./tokenStore.ts";
import { initBridgeWs } from "./clientWss.ts";

export const BRIDGE_STATE_DIR =
  process.env.BRIDGE_STATE_DIR || "/var/lib/hococo-bridge";

export const BRIDGE_KEY_PATH = path.join(BRIDGE_STATE_DIR, "bridge.key.pem");
export const DEVICE_CERT_CHAIN_PATH = path.join(
  BRIDGE_STATE_DIR,
  "bridge-device-chain.pem"
);
export const CA_BUNDLE_PATH = path.join(
  BRIDGE_STATE_DIR,
  "bridge-ca-bundle.pem"
);
export const BRIDGE_SETTINGS_PATH = path.join(
  BRIDGE_STATE_DIR,
  "bridge-settings.json"
);

export type BridgeSettings = {
  pairingTxId: string | null;
  bridgeConfigurationId: string | null;
  wssUrl: string | null;
  apiBaseUrl: string | null;
  updatedAt: string;
};

export function ensureBridgeStateDir() {
  if (!fs.existsSync(BRIDGE_STATE_DIR)) {
    fs.mkdirSync(BRIDGE_STATE_DIR, { recursive: true });
    try {
      fs.chmodSync(BRIDGE_STATE_DIR, 0o700);
    } catch {
      // ignore
    }
  }
}

export function loadBridgeSettings(): BridgeSettings | null {
  if (!fs.existsSync(BRIDGE_SETTINGS_PATH)) return null;
  try {
    const raw = fs.readFileSync(BRIDGE_SETTINGS_PATH, "utf8");
    return JSON.parse(raw) as BridgeSettings;
  } catch (e) {
    console.warn("[Bridge] Failed to load settings JSON:", e);
    return null;
  }
}

export function saveBridgeSettings(settings: BridgeSettings) {
  ensureBridgeStateDir();
  fs.writeFileSync(
    BRIDGE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
}

export function hasExistingCertificates(): boolean {
  return (
    fs.existsSync(BRIDGE_KEY_PATH) &&
    fs.existsSync(DEVICE_CERT_CHAIN_PATH) &&
    fs.existsSync(CA_BUNDLE_PATH)
  );
}

/**
 * Bootstrap bridge on startup if it already has certs & settings
 */
export async function bootstrapExistingBridge(apiBase: string) {
  if (!hasExistingCertificates()) {
    console.log(
      "[Bridge] No existing certificates found; waiting for pairing flow."
    );
    return;
  }

  const settings = loadBridgeSettings();
  if (!settings || !settings.bridgeConfigurationId) {
    console.log(
      "[Bridge] Certificates exist but settings/bridgeConfigurationId missing; waiting for pairing."
    );
    return;
  }

  const effectiveApiBase = settings.apiBaseUrl || apiBase;

  console.log(
    "[Bridge] Found existing certs & settings. Trying to fetch token and connect WSS…"
  );

  try {
    const tlsOptions = apiClientConfig();
    const tokenData = await getToken(
      settings.bridgeConfigurationId,
      tlsOptions,
      effectiveApiBase
    );
    storeTokenFromResponse(tokenData);

    initBridgeWs(settings);
    console.log("[Bridge] Bootstrap with existing certs + token succeeded.");
  } catch (err: any) {
    console.error(
      "[Bridge] Failed to bootstrap with existing certs/token:",
      err.message || err
    );
  }
}
