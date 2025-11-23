import fs from "fs";
import path from "path";
import { apiClientConfig } from "../config/config.ts";
import { getToken } from "../tokens/tokenHandler.ts";
import { storeTokenFromResponse } from "../tokens/tokenStore.ts";
import { initBridgeWs } from "./wss.ts";
import {
  hasExistingCertificates,
  loadBridgeSettings,
} from "../config/settings.ts";

/**
 * Bootstrap bridge on startup if it already has certs & settings
 */
export async function bootstrapExistingBridge() {
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

  console.log(
    "[Bridge] Found existing certs & settings. Trying to fetch token and connect WSS…"
  );

  try {
    const tokenData = await getToken();
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
