import fs from "fs";
import path from "path";

const BRIDGE_STATE_DIR =
  process.env.BRIDGE_STATE_DIR || "/var/lib/hococo-bridge";

const listenerConfig = Object.freeze({
  host: process.env.WSS_HOST || "ws.hococo.internal",
  port: Number(process.env.WSS_PORT || 9443),
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

export const clientConfig = buildClientConfig;
export { certConfig, listenerConfig, httpConfig };
