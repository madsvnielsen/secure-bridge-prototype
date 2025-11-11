import axios from "axios";
import WebSocket from "ws";
import fs from "fs";
import https from "https";

const apiBase = "https://edge:443/api";
const wsUrl = "wss://edge:443/wss"; 

const ca = fs.readFileSync("/etc/ssl/certs/hococo_ca.crt");

const httpsAgent = new https.Agent({
  ca
});

async function tick() {
  try {
    const r = await axios.get(`${apiBase}/health`, {
      timeout: 3000,
      httpsAgent,
    });
    console.log("api health", r.data);
  } catch (e) {
    console.log("api fail", e.message);
  }

  const ws = new WebSocket(wsUrl, {
    ca
  });

  ws.on("open", () => {
    console.log("ws open");
    ws.send(JSON.stringify({ hello: "bridge" }));
  });
  ws.on("message", (m) => console.log("ws", m.toString()));
  ws.on("close", () => console.log("ws closed"));
  ws.on("error", (err) => console.log("ws error", err.message));
}

tick();
setInterval(tick, 15000);
