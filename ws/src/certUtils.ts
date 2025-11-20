import { Certificate } from "@fidm/x509";

type ClientRole =
  | { type: "bridge"; bridgeId: string }
  | { type: "api" }
  | { type: "unknown" };

export function getClientRoleFromCert(pem: string): ClientRole {
  const cert = Certificate.fromPEM(Buffer.from(pem));

  const sanExt = cert.extensions.find((ext) => ext.name === "subjectAltName");
  if (!sanExt || !sanExt.altNames) {
    return { type: "unknown" };
  }

  let bridgeId: string | null = null;
  let hasApi = false;

  for (const alt of sanExt.altNames) {
    const tag = (alt as any).type ?? (alt as any).tag;
    const uriField = (alt as any).uri;
    let valueStr: string | undefined;

    if (typeof uriField === "string") {
      valueStr = uriField;
    } else if (typeof (alt as any).value === "string") {
      valueStr = (alt as any).value;
    } else if (Buffer.isBuffer((alt as any).value)) {
      valueStr = (alt as any).value.toString("utf8");
    }

    if (!valueStr) continue;

    if (tag === 6) {
      let uri = valueStr;
      if (uri.startsWith("URI:")) {
        uri = uri.substring("URI:".length);
      }

      if (uri.startsWith("bridge:")) {
        bridgeId = uri.substring("bridge:".length);
      }

      if (uri === "api") {
        hasApi = true;
      }
    }

    if (tag === 2) {
      const dns = valueStr;
      if (dns === "api" || dns === "api.hococo.internal") {
        hasApi = true;
      }
    }
  }

  if (bridgeId) {
    return { type: "bridge", bridgeId };
  }
  if (hasApi) {
    return { type: "api" };
  }
  return { type: "unknown" };
}