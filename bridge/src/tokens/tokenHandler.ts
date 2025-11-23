import { buildHttpsClient } from "../config/config";
import { loadBridgeSettings } from "../config/settings";

export async function getToken() {
  const settings = loadBridgeSettings();
  const bridgeConfigurationId = settings?.bridgeConfigurationId;

  if (!bridgeConfigurationId) {
    throw new Error("Bridge configuration ID is not set in settings");
  }

  const client = buildHttpsClient();
  const res = await client.post(
    `/bridges/${bridgeConfigurationId}/token`,
    null,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  console.log("Token response status:", res.status);
  console.log("Token response data:", res.data);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Token request failed: ${res.status} ${res.statusText} – ${JSON.stringify(
        res.data
      )}`
    );
  }

  return res.data;
}
