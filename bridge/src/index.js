import axios from "axios";
import WebSocket from "ws";

const apiBase = "http://edge/api";
const wsUrl = "ws://edge/ws/";

async function tick() {
  try {
    const r = await axios.get(`${apiBase}health`, { timeout: 3000 });
    console.log("api health", r.data);
  } catch (e) {
    console.log("api fail", e.message);
  }
  const ws = new WebSocket(wsUrl);
  ws.on("open", () => ws.send(JSON.stringify({ hello: "bridge" })));
  ws.on("message", (m) => console.log("ws", m.toString()));
  ws.on("close", () => console.log("ws closed"));
}
tick();
setInterval(tick, 15000);
