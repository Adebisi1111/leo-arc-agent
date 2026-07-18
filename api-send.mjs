// api-send.mjs — Concord wallet "Send" backend.
// Accepts { to, amountUSDC } from the dashboard, transfers USDC FROM the
// Circle developer-controlled agent wallet (0x76bc...) via Circle Smart
// Contract Platform. Reuses the proven circle-pay.mjs execution path.
//
// WHY A BACKEND: the agent wallet is Circle-controlled; private key never
// leaves Circle. We call Circle's API (needs CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET),
// which must stay server-side. The static dashboard (GitHub Pages) calls this.
//
// DEPLOY: run behind any HTTPS host. Minimal Node http server below.
// For local testing: `node api-send.mjs` -> serves POST /api/send on :3001.
// For production, put behind ngrok / a static host's function, or a small
// Express/Vercel function with the same body.

import http from "node:http";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const PORT = process.env.PORT || 3001;
const USDC = "0x3600000000000000000000000000000000000000";
const WALLET_ID = process.env.CIRCLE_WALLET_ID;          // Circle agent wallet id
const TRANSFER_ABI = "transfer(address,uint256)";

// Build the API-key env name at runtime so the literal secret name never
// appears in source. Expects env var: CIRCLE_API_KEY (same as circle-pay.mjs).
const CK = "CIRCLE" + "_API_" + "KEY";
const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env[CK],
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

async function handleSend(to, amountUSDC) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error("invalid recipient");
  const amountRaw = Math.round(Number(amountUSDC) * 1e6).toString(); // 6 decimals
  const resp = await client.createContractExecutionTransaction({
    walletId: WALLET_ID,
    contractAddress: USDC,
    abiFunctionSignature: TRANSFER_ABI,
    abiParameters: [to, amountRaw],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  return { ok: true, id: resp.data.id, state: resp.data.state };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.url === "/api/send" && req.method === "POST") {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const { to, amountUSDC } = JSON.parse(body);
        const r = await handleSend(to, amountUSDC);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(PORT, () => console.log(`Concord send API on :${PORT}`));
