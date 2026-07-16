// webhook_receiver.mjs — local endpoint behind ngrok (https://stingray-science-liquid.ngrok-free.dev)
// GET /            -> status page (so the public URL shows something live)
// POST / or /webhook -> accepts Circle SCP eventMonitor deliveries, logs to webhook_hits.log
import http from "node:http";
import fs from "node:fs";

const PORT = 3000;
const LOG = "webhook_hits.log";
const log = (s) => { const line = `[${new Date().toISOString()}] ${s}\n`; fs.appendFileSync(LOG, line); console.log(line.trim()); };

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Leo (Arc Y) event endpoint — LIVE</h2>
<p>Forwarded by ngrok: stingray-science-liquid.ngrok-free.dev</p>
<p>POST events to /webhook (Circle Contracts monitor deliveries land here).</p>`);
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const ev = JSON.parse(body);
      if (ev.notificationType === "contracts.eventLog") {
        const n = ev.notification;
        log(`WEBHOOK event: ${n.eventSignature}`);
        log(`   contract ${n.contractAddress} | tx ${n.txHash} | block ${n.blockHeight}`);
      } else {
        log(`WEBHOOK ${ev.notificationType}`);
      }
    } catch {
      log(`WEBHOOK raw: ${body.slice(0, 200)}`);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ received: true }));
  });
});
server.listen(PORT, () => log(`Webhook receiver on http://localhost:${PORT} (GET + POST /webhook)`));
