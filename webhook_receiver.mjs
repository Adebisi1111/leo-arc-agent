// webhook_receiver.mjs — local endpoint behind a public tunnel
// GET /            -> status page (so the public URL shows something live)
// POST / or /webhook -> accepts Circle SCP eventMonitor deliveries, logs to webhook_hits.log
//
// NOTE: Circle Event Monitor webhooks must reach this server. Expose it with a
// tunnel and set WEBHOOK_URL, e.g. cloudflared: `cloudflared tunnel --url http://localhost:3000`.
// Then register `${WEBHOOK_URL}/webhook` as the monitor destination in the Circle Console.
import http from "node:http";
import fs from "node:fs";

const PORT = process.env.WEBHOOK_PORT ? Number(process.env.WEBHOOK_PORT) : 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "(set WEBHOOK_URL to your live tunnel endpoint)";
const LOG = "webhook_hits.log";
const log = (s) => { const line = `[${new Date().toISOString()}] ${s}\n`; fs.appendFileSync(LOG, line); console.log(line.trim()); };

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Concord (Arc) event endpoint — LIVE</h2>
<p>Forwarded by tunnel: ${WEBHOOK_URL}</p>
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
server.listen(PORT, () => log(`Webhook receiver on http://localhost:${PORT} (GET + POST /webhook) — public URL: ${WEBHOOK_URL}`));
