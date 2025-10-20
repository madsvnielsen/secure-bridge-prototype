import { WebSocketServer } from "ws";
const port = Number(process.env.PORT || 8080);
const wss = new WebSocketServer({ port });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ ok: true }));
  ws.on("message", (m) => ws.send(m));
});
console.log("ws up on", port);
