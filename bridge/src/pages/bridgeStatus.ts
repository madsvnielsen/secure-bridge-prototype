

export const bridgeStatusHtml = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Hococo Bridge – Status</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 2rem;
    }


    .container {
      max-width: 700px;
      margin: 0 auto;
      background: #1e293b;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 0 30px rgba(0,0,0,0.4);
    }

    h1 {
      margin-top: 0;
      font-size: 1.8rem;
      color: #93c5fd;
    }

    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 0.5rem;
      background: #3b82f6;
      color: white;
      font-size: 1rem;
      cursor: pointer;
      margin-bottom: 1rem;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    pre {
      background: #0f172a;
      padding: 1rem;
      border-radius: 0.5rem;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #334155;
      font-size: 0.9rem;
    }

    .status-line {
      color: #38bdf8;
    }

    .finalize {
      color: #4ade80;
    }

    .error {
      color: #f87171;
    }
  </style>
</head>

<body>
  <div class="container">
    <h1>Hococo Bridge – Pairing Status</h1>

    <button id="pairBtn">Start Pairing</button>

    <pre id="output">Idle. Click "Start Pairing" to begin.</pre>
  </div>

<script>
let currentPairingTxId = null;
let pollTimer = null;

const btn = document.getElementById("pairBtn");
const out = document.getElementById("output");

function log(msg, cssClass = "") {
  if (cssClass) {
    out.innerHTML += "\\n<span class='" + cssClass + "'>" + msg + "</span>";
  } else {
    out.innerHTML += "\\n" + msg;
  }
  out.scrollTop = out.scrollHeight;
}

async function pollStatus() {
  if (!currentPairingTxId) return;

  try {
    const res = await fetch("/bridge/pair/status?pairingTxId=" + encodeURIComponent(currentPairingTxId));
    const data = await res.json();

    log("[poll] Status = " + data.status, "status-line");

    if (data.status === "await_finalization") {
      clearInterval(pollTimer);

      log("Status is 'await_finalization' → Finalizing pairing…", "finalize");

      const finRes = await fetch("/bridge/pair/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingTxId: currentPairingTxId }),
      });

      const finData = await finRes.json();
      log("Finalize response:", "finalize");
      log(JSON.stringify(finData, null, 2));

    } else if (data.status !== "pending") {
      // Any other state is cancel/failure
      clearInterval(pollTimer);
      log("Pairing cancelled or ended (status = " + data.status + ")", "error");
    }

  } catch (err) {
    log("Polling error: " + err.message, "error");
  }
}

document.getElementById("pairBtn").addEventListener("click", async () => {
  btn.disabled = true;
  out.innerHTML = "Starting pairing…";

  try {
    const res = await fetch("/bridge/pair/init", { method: "POST" });
    const data = await res.json();

    currentPairingTxId = data.pairingTxId;

    log("Pairing started.");
    log("Pairing code: " + data.pairingCode);
    log("pairingTxId: " + data.pairingTxId);
    log("Expires: " + data.expiresAt);

    // Start polling every 3 seconds
    pollTimer = setInterval(pollStatus, 3000);

  } catch (err) {
    log("Error: " + err.message, "error");
    btn.disabled = false;
  }
});
</script>

</body>
</html>
  `