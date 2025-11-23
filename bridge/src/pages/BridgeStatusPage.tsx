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
        startBtn.textContent = loading ? "Starting…" : "Start pairing";
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
          setState("Pending (waiting for Hub claim)");
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
            setState("Pending (waiting for Hub claim)");
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
          body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f172a; color: #e5e7eb; }
          .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr); gap: 1.5rem; align-items: flex-start; }
          .card { background: #020617; border-radius: 0.75rem; padding: 1.5rem 2rem; border: 1px solid #1e293b; }
          .badge { display: inline-block; padding: 0.1rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
          .badge-ok { background: #16a34a33; color: #bbf7d0; border: 1px solid #16a34a; }
          .badge-warn { background: #f59e0b33; color: #fef3c7; border: 1px solid #f59e0b; }
          .badge-err { background: #dc262633; color: #fecaca; border: 1px solid #dc2626; }
          h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
          h2 { font-size: 1.1rem; margin-top: 1.25rem; margin-bottom: 0.4rem; }
          dl { margin: 0; }
          dt { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-top: 0.75rem; }
          dd { margin: 0.1rem 0 0.4rem 0; }
          code { font-size: 0.85rem; background: #020617; padding: 0.15rem 0.4rem; border-radius: 0.35rem; }
          button.primary {
            appearance: none;
            border: none;
            border-radius: 999px;
            padding: 0.45rem 1.1rem;
            font-size: 0.9rem;
            font-weight: 600;
            background: #4f46e5;
            color: white;
            cursor: pointer;
          }
          button.primary:disabled {
            opacity: 0.6;
            cursor: default;
          }
          .steps { margin-top: 0.75rem; font-size: 0.85rem; color: #9ca3af; }
          .steps li { margin-bottom: 0.15rem; }
          .steps .dot {
            display: inline-block;
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 999px;
            margin-right: 0.4rem;
          }
          .dot-idle { background: #64748b; }
          .dot-active { background: #facc15; }
          .dot-done { background: #22c55e; }
          #pairing-log {
            margin-top: 0.75rem;
            font-size: 0.8rem;
            max-height: 8rem;
            overflow-y: auto;
            border-top: 1px solid #1e293b;
            padding-top: 0.5rem;
            color: #9ca3af;
          }
        `}</style>
      </head>
      <body>
        <div className="layout">
          <div className="card">
            <h1>Hococo Bridge Status</h1>
            <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
              Prototype bridge with mTLS + certificate-bound tokens.
            </p>

            <h2>Pairing</h2>

            <p>
              State:{" "}
              <span className="badge badge-warn" id="pairing-state">
                {paired ? "Paired" : "Not paired"}
              </span>
            </p>

            <dl>
              <dt>Pairing code</dt>
              <dd>
                <code id="pairing-code">–</code>
              </dd>

              <dt>Pairing Tx ID</dt>
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

            <div style={{ marginTop: "0.75rem" }}>
              <button className="primary" id="pairing-start-btn">
                Start pairing
              </button>
            </div>

            <div id="pairing-log" />
          </div>

          {/* Right: Token / Auth state */}
          <div className="card">
            <h2>Token</h2>
            <p>
              Token state:{" "}
              <span
                className={`badge ${tokenValid ? "badge-ok" : "badge-err"}`}
              >
                {tokenValid ? "In memory" : "No token"}
              </span>
            </p>
            {token && (
              <dl>
                <dt>Scope</dt>
                <dd>
                  <code>{token.scope}</code>
                </dd>
                <dt>Expires at</dt>
                <dd>{new Date(token.expiresAt * 1000).toISOString()}</dd>
              </dl>
            )}
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: pairingScript }}></script>
      </body>
    </html>
  );
}
