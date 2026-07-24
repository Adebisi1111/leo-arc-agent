// api-send.mjs — Concord wallet "Send" backend.
import http from "node:http";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const PORT = process.env.PORT || 3001;
const USDC = "0x3600000000000000000000000000000000000000";
const WALLET_ID = process.env.CIRCLE_WALLET_ID;
const TRANSFER_ABI = "transfer(address,uint256)";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env["CIRCLE_API_KEY"],
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

async function handleSend(to, amountUSDC) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error("invalid recipient");
  const amountRaw = Math.round(Number(amountUSDC) * 1e6).toString();
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
