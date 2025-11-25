import React from "react";

export type BridgeSettings = {
  pairingTxId: string | null;
  bridgeConfigurationId: string | null;
  wssUrl: string | null;
  apiBaseUrl: string | null;
  updatedAt: string;
};

export type BridgeToken = {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresAt: number; // epoch seconds
};

export type BridgeStatusProps = {
  settings: BridgeSettings | null;
  token: BridgeToken | null;
};

export function BridgeStatusPage({ settings, token }: BridgeStatusProps) {
  const paired = !!settings?.bridgeConfigurationId;
  const tokenValid = !!token;

  const pairingScript = `
    (function () {
      const startBtn = document.getElementById("pairing-start-btn");
      const stateEl = document.getElementById("pairing-state");
      const codeEl = document.getElementById("pairing-code");
      const txIdEl = document.getElementById("pairing-tx-id");
      const bridgeIdEl = document.getElementById("pairing-bridge-id");
      const logEl = document.getElementById("pairing-log");

      let currentTxId = ${JSON.stringify(settings?.pairingTxId ?? null)};
      let pollTimer = null;
      let isFinalizing = false;

      function log(msg) {
        if (!logEl) return;
        const time = new Date().toISOString();
        const line = document.createElement("div");
        line.textContent = "[" + time + "] " + msg;
        logEl.prepend(line);
      }

      function setState(text) {
        if (stateEl) stateEl.textContent = text;
      }

      function setCode(text) {
        if (codeEl) codeEl.textContent = text || "–";
      }

      function setTxId(text) {
        if (txIdEl) txIdEl.textContent = text || "–";
      }

      function setBridgeId(text) {
        if (bridgeIdEl) bridgeIdEl.textContent = text || "–";
      }

      function setLoading(loading) {
        if (!startBtn) return;
        startBtn.disabled = loading;
        startBtn.textContent = loading ? "Starter…" : "Start pairing";
      }

      async function callInit() {
        try {
          setLoading(true);
          setState("Starting pairing…");
          log("Calling /bridge/pair/init");

          const res = await fetch("/bridge/pair/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            const body = await res.text();
            setState("Error starting pairing");
            log("Init failed: " + res.status + " " + body);
            setLoading(false);
            return;
          }

          const data = await res.json();
          currentTxId = data.pairingTxId;
          setTxId(currentTxId);
          setCode(data.pairingCode || "—");
          setState("Pending");
          log("Pairing started. Code: " + (data.pairingCode || "n/a"));

          startPolling();
        } catch (err) {
          setState("Error starting pairing");
          log("Init exception: " + (err && err.toString()));
        } finally {
          setLoading(false);
        }
      }

      async function pollStatusOnce() {
        if (!currentTxId) {
          log("pollStatusOnce: no currentTxId");
          return;
        }
        try {
          const url = "/bridge/pair/status?pairingTxId=" + encodeURIComponent(currentTxId);
          const res = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
          });

          if (!res.ok) {
            const body = await res.text();
            log("Status failed: " + res.status + " " + body);
            return;
          }

          const data = await res.json();
          const status = data.status || "unknown";
          log("Status: " + status);

          if (status === "pending") {
            setState("Pending ");
          } else if (status === "await_finalization") {
            setState("Claimed by Hub – finalizing…");
            stopPolling();
            if (!isFinalizing) {
              finalizePairing();
            }
          } else if (status === "completed") {
            setState("Completed (paired)");
          } else if (status === "expired") {
            setState("Expired – restart pairing");
            stopPolling();
          } else {
            setState("Status: " + status);
          }
        } catch (err) {
          log("Status exception: " + (err && err.toString()));
        }
      }

      function startPolling() {
        stopPolling();
        pollStatusOnce();
        pollTimer = setInterval(pollStatusOnce, 3000);
      }

      function stopPolling() {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }

      async function finalizePairing() {
        if (!currentTxId) {
          log("finalizePairing: no currentTxId");
          return;
        }
        isFinalizing = true;
        try {
          log("Calling /bridge/pair/finalize for " + currentTxId);
          const res = await fetch("/bridge/pair/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pairingTxId: currentTxId }),
          });

          if (!res.ok) {
            const body = await res.text();
            setState("Error finalizing pairing");
            log("Finalize failed: " + res.status + " " + body);
            return;
          }

          const data = await res.json();
          setState("Paired");
          if (data.bridgeConfigurationId) {
            setBridgeId(data.bridgeConfigurationId);
          }
          log("Finalize succeeded. BridgeConfigurationId=" + (data.bridgeConfigurationId || "n/a"));
        } catch (err) {
          setState("Error finalizing pairing");
          log("Finalize exception: " + (err && err.toString()));
        } finally {
          isFinalizing = false;
        }
      }

      if (startBtn) {
        startBtn.addEventListener("click", function () {
          callInit();
        });
      }

      const initialBridgeId = ${JSON.stringify(
        settings?.bridgeConfigurationId ?? null
      )};
      if (initialBridgeId) {
        setBridgeId(initialBridgeId);
        setState("Paired");
      } else {
        setState("Not paired");
      }

    })();
  `;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Hococo Bridge Status</title>
        <style>{`
          :root {
            --hococo_green: #193631;
            --hococo_violet: #642fff;
            --hococo-orange: #ffd068;
            --white-smoke: #e6ebed;
            --white: #ffffff;
            --royal-blue: #3679ff;
            --shadow: #e6ebed;
            --light-grey: #f4f4f4;
            --hococo_grey: #f4f6f7;
            --misty-rose: #ffe3e3;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 2rem;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: radial-gradient(circle at top left, #ffffff 0, var(--hococo_grey) 55%, #dde5f0 100%);
            color: var(--hococo_green);
          }

          .app-shell {
            max-width: 1120px;
            margin: 0 auto;
          }

          .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            gap: 1rem;
          }

          .page-title {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .page-title h1 {
            font-size: 1.7rem;
            letter-spacing: -0.02em;
            margin: 0;
          }

          .page-title p {
            margin: 0;
            font-size: 0.9rem;
            color: #6b7280;
          }

          .page-chip {
            padding: 0.25rem 0.8rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            background: var(--white);
            border: 1px solid var(--shadow);
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
          }

          .page-chip-dot {
            width: 0.45rem;
            height: 0.45rem;
            border-radius: 999px;
            background: var(--hococo_violet);
          }

          .layout {
            display: grid;
            grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr);
            gap: 1.5rem;
            align-items: flex-start;
          }

          .card {
            background: var(--white);
            border-radius: 1rem;
            padding: 1.5rem 1.75rem;
            border: 1px solid var(--shadow);
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.04);
          }

          h2 {
            font-size: 1.05rem;
            margin: 0 0 0.25rem 0;
          }

          .subtle {
            font-size: 0.85rem;
            color: #6b7280;
          }

          .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.12rem 0.7rem;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 600;
            border: 1px solid transparent;
          }

          .badge-ok {
            background: rgba(25, 54, 49, 0.08);
            color: var(--hococo_green);
            border-color: rgba(25, 54, 49, 0.4);
          }

          .badge-warn {
            background: rgba(255, 208, 104, 0.22);
            color: #92400e;
            border-color: rgba(234, 179, 8, 0.6);
          }

          .badge-err {
            background: rgba(220, 38, 38, 0.08);
            color: #b91c1c;
            border-color: rgba(220, 38, 38, 0.5);
          }

          .pill-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-top: 0.35rem;
          }

          .pill {
            display: inline-flex;
            align-items: center;
            padding: 0.2rem 0.6rem;
            border-radius: 999px;
            font-size: 0.78rem;
            background: var(--hococo_grey);
            color: #4b5563;
          }

          .pill-label {
            font-weight: 600;
            margin-right: 0.3rem;
          }

          dl {
            margin: 0.5rem 0 0 0;
          }

          dt {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #9ca3af;
            margin-top: 0.7rem;
          }

          dd {
            margin: 0.15rem 0 0.25rem 0;
            font-size: 0.9rem;
          }

          code {
            font-size: 0.85rem;
            background: var(--hococo_grey);
            padding: 0.15rem 0.4rem;
            border-radius: 999px;
          }

          button.primary {
            appearance: none;
            border: none;
            border-radius: 999px;
            padding: 0.5rem 1.3rem;
            font-size: 0.9rem;
            font-weight: 600;
            background: linear-gradient(135deg, var(--royal-blue), var(--hococo_violet));
            color: white;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            box-shadow: 0 12px 25px rgba(100, 47, 255, 0.28);
            transition: transform 0.08s ease, box-shadow 0.08s ease, filter 0.08s ease;
          }

          button.primary span.dot {
            width: 0.45rem;
            height: 0.45rem;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.85);
          }

          button.primary:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(1.03);
            box-shadow: 0 16px 32px rgba(100, 47, 255, 0.35);
          }

          button.primary:disabled {
            opacity: 0.7;
            cursor: default;
            box-shadow: none;
          }

          #pairing-log {
            margin-top: 0.9rem;
            font-size: 0.8rem;
            max-height: 9rem;
            overflow-y: auto;
            border-radius: 0.75rem;
            background: var(--hococo_grey);
            padding: 0.6rem 0.7rem;
            color: #4b5563;
            border: 1px dashed var(--white-smoke);
          }

          #pairing-log div + div {
            margin-top: 0.12rem;
          }

          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-top: 0.75rem;
            font-size: 0.78rem;
            color: #9ca3af;
          }

          .token-box {
            margin-top: 0.5rem;
            padding: 0.7rem 0.9rem;
            border-radius: 0.8rem;
            background: linear-gradient(135deg, #eff4ff, #fdfbff);
            border: 1px solid rgba(54, 121, 255, 0.25);
          }

          .token-box-empty {
            background: var(--misty-rose);
            border-color: rgba(220, 38, 38, 0.35);
          }

          .token-box-title {
            font-size: 0.8rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 0.25rem;
          }

          @media (max-width: 900px) {
            body {
              padding: 1.25rem;
            }
            .layout {
              grid-template-columns: 1fr;
            }
            .page-header {
              flex-direction: column;
              align-items: flex-start;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="app-shell">
          <header className="page-header">
            <div className="page-title">
              <h1>Hococo Bridge Status</h1>
              <p>Prototype bridge using mTLS and certificate-bound access tokens.</p>
            </div>
            <div className="page-chip">
              <span className="page-chip-dot" />
              <span>Local diagnostics view</span>
            </div>
          </header>

          <div className="layout">
            {/* Left: Pairing */}
            <div className="card">
              <div className="section-header">
                <h2>Pairing</h2>
                <span
                  className={`badge ${
                    paired ? "badge-ok" : "badge-warn"
                  }`}
                  id="pairing-state"
                >
                  {paired ? "Paired" : "Not paired"}
                </span>
              </div>
              <p className="subtle">
                Start a new pairing flow from this machine and finalize it in the Hococo Admin Hub.
              </p>

              <dl>
                <dt>Pairing code</dt>
                <dd>
                  <code id="pairing-code">–</code>
                </dd>

                <dt>Pairing transaction</dt>
                <dd>
                  <code id="pairing-tx-id">{settings?.pairingTxId ?? "–"}</code>
                </dd>

                <dt>Bridge configuration ID</dt>
                <dd>
                  <code id="pairing-bridge-id">
                    {settings?.bridgeConfigurationId ?? "–"}
                  </code>
                </dd>
              </dl>

              <div style={{ marginTop: "0.9rem" }}>
                <button className="primary" id="pairing-start-btn">
                  <span className="dot" />
                  <span>Start pairing</span>
                </button>
              </div>

              <div id="pairing-log" />

              <div className="meta-row">
                <span>
                  Last updated:{" "}
                  {settings?.updatedAt
                    ? new Date(settings.updatedAt).toLocaleString()
                    : "–"}
                </span>
              </div>
            </div>

            {/* Right: Connectivity + Token */}
            <div className="card">
              <div className="section-header">
                <h2>Connectivity & Token</h2>
                <span
                  className={`badge ${tokenValid ? "badge-ok" : "badge-err"}`}
                >
                  {tokenValid ? "Token in memory" : "No token"}
                </span>
              </div>

              <div className="pill-row">
                <span className="pill">
                  <span className="pill-label">WSS</span>
                  <span>{settings?.wssUrl ?? "-"}</span>
                </span>
                <span className="pill">
                  <span className="pill-label">API</span>
                  <span>{settings?.apiBaseUrl ?? "-"}</span>
                </span>
              </div>

              {token ? (
                <div className="token-box">
                  <div className="token-box-title">Access token</div>
                  <dl>
                    <dt>Scope</dt>
                    <dd>
                      <code>{token.scope}</code>
                    </dd>
                    <dt>Expires at</dt>
                    <dd>{new Date(token.expiresAt * 1000).toISOString()}</dd>
                  </dl>
                </div>
              ) : (
                <div className="token-box token-box-empty">
                  <div className="token-box-title">No active token</div>
                  <p className="subtle">
                    The bridge will request a new certificate-bound access token
                    the next time it talks to the Hococo API.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: pairingScript }}></script>
      </body>
    </html>
  );
}
