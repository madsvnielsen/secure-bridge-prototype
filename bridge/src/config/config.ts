import fs from "fs";
import path from "path";
import https from "https";
import axios from "axios";
import { loadBridgeSettings } from "./settings";

const BRIDGE_STATE_DIR =
  process.env.BRIDGE_STATE_DIR || "/var/lib/hococo-bridge";

const listenerConfig = Object.freeze({
  host: process.env.WSS_HOST || "ws.hococo.internal",
  port: Number(process.env.WSS_PORT || 9443),
});
const httpListenerConfig = Object.freeze({
  host: "api.hococo.internal",
  port: 443,
});

const httpConfig = Object.freeze({
    enableHttp2: false,
    onlyHttp2: false,
    allowHTTP1: true,
    minVersion: 'TLSv1.2'
});

const certConfig = Object.freeze({
  keyPath: BRIDGE_STATE_DIR,
  caBundle: path.join(BRIDGE_STATE_DIR, "bridge-ca-bundle.pem"),
  clientKey: path.join(BRIDGE_STATE_DIR, "bridge.key.pem"),
  clientCert: path.join(BRIDGE_STATE_DIR, "bridge-device-chain.pem"),
});

const buildClientConfig = () =>
  Object.freeze({
    ...listenerConfig,
    ...httpConfig,

    key: fs.readFileSync(certConfig.clientKey, "utf8"),
    cert: fs.readFileSync(certConfig.clientCert, "utf8"),
    ca: fs.readFileSync(certConfig.caBundle, "utf8"),
    servername: listenerConfig.host,
  });

const buildAPIClientConfig = () =>
Object.freeze({
  ...httpListenerConfig,
  ...httpConfig,

  key: fs.readFileSync(certConfig.clientKey, "utf8"),
  cert: fs.readFileSync(certConfig.clientCert, "utf8"),
  ca: fs.readFileSync(certConfig.caBundle, "utf8"),
  servername: httpListenerConfig.host,
  });


export const buildHttpsClient = () => {
  const options = apiClientConfig();
  const settings = loadBridgeSettings();
  
  const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    key: options.key,
    cert: options.cert,
    ca: options.ca,
  });
  
  if(!settings?.apiBaseUrl) {
    throw new Error("API Base URL is not defined in bridge settings");
  }

  return axios.create({
    baseURL: settings?.apiBaseUrl,         
    httpsAgent,
    timeout: 10_000,
  });
}


export const clientConfig = buildClientConfig;
export const apiClientConfig = buildAPIClientConfig;
export { certConfig, listenerConfig, httpConfig};
