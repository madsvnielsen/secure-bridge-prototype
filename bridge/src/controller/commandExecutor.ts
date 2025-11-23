import { AxiosInstance } from "axios";
import { getCurrentToken } from "../tokens/tokenStore";
import { BridgeSettings } from "../config/settings";

export const executeCommand = async (
  msg: any,
  apiClient: AxiosInstance,
  settings: BridgeSettings
) => {
  const { requestId, payload } = msg;

  // Dummy execution
  let success = true;
  let result: any = {
    echo: payload,
    dummy: "successful execution",
  };
  let error: string | null = null;

  try {
    // Real logic would go here
  } catch (e: any) {
    success = false;
    error = e.message ?? "Execution error";
    result = null;
  }

  try {
    await postBridgeResult(apiClient, {
      requestId,
      bridgeConfigurationId: settings.bridgeConfigurationId!,
      success,
      result,
      error,
    });
    console.log("Bridge sent result for", requestId);
  } catch (err: any) {
    console.error("FAILED to POST result to API:", err.message);
  }
};

async function postBridgeResult(
  apiClient: AxiosInstance,
  payload: {
    requestId: string;
    bridgeConfigurationId: string;
    success: boolean;
    result: any;
    error: string | null;
  }
) {
  const token = getCurrentToken();
  if (!token) {
    console.error("No valid bridge token available");
    return;
  }

  await apiClient.post("/bridges/result", payload, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  });
}
