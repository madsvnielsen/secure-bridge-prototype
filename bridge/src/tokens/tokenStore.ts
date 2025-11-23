export type BridgeToken = {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
};

let currentToken: BridgeToken | null = null;

export function storeTokenFromResponse(data: {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresIn: number;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  currentToken = {
    accessToken: data.accessToken,
    tokenType: data.tokenType,
    scope: data.scope,
    expiresAt: nowSec + data.expiresIn,
  };
  console.log(
    "[TokenStore] Stored token, expires at",
    new Date(currentToken.expiresAt * 1000).toISOString()
  );
}

export function getCurrentToken(): BridgeToken | null {
  return currentToken;
}

export function isTokenValid(leewaySeconds = 30): boolean {
  if (!currentToken) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return currentToken.expiresAt - nowSec > leewaySeconds;
}
