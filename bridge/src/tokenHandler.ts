import https from "https";
import axios from "axios";

export async function getToken(
  bridgeConfigurationId: string,
  tlsOptions: {
    key: Buffer | string;
    cert: Buffer | string;
    ca: Buffer | string | string[];
  },
  apiBase: string
) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    key: tlsOptions.key,
    cert: tlsOptions.cert,
    ca: tlsOptions.ca,
  });

  const client = axios.create({
    baseURL: apiBase,         
    httpsAgent,
    timeout: 10_000,
  });

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
