// Vercel serverless: self-serve Concord test sandbox (self-contained, lazy SDK init)
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
const TOKEN = "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";

function client() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });
}

export default async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const url = new URL(req.url, "http://localhost");
  const action = url.searchParams.get("action");
  try {
    const c = client();
    if (action === "create") {
      const r = await c.createWallets({ walletSetId: process.env.CIRCLE_WALLET_SET_ID, blockchains: ["ARC-TESTNET"], count: 1 });
      const w = r?.data?.wallets?.[0];
      if (w) res.status(200).json({ ok: true, address: w.address, walletId: w.id, state: w.state });
      else res.status(200).json({ ok: false, error: "create failed", raw: r?.data });
      return;
    }
    if (action === "faucet") {
      const addr = url.searchParams.get("wallet");
      const r = await c.createTransaction({
        walletId: process.env.CIRCLE_WALLET_ID, tokenId: TOKEN, destinationAddress: addr, amounts: ["1"],
        blockchain: "ARC-TESTNET", fee: { type: "level", config: { feeLevel: "LOW" } } });
      const tx = r?.data?.transaction || r?.data;
      if (r?.data?.id || tx?.id) res.status(200).json({ ok: true, state: tx?.state, id: tx?.id, note: "funded 1 USDC from test pool" });
      else res.status(200).json({ ok: false, error: "fund failed", raw: r?.data });
      return;
    }
    if (action === "schedule") {
      const wallet = url.searchParams.get("wallet");
      const to = url.searchParams.get("to");
      const amt = url.searchParams.get("amt") || "0.01";
      const r = await c.createTransaction({
        walletId: wallet, tokenId: TOKEN, destinationAddress: to, amounts: [String(amt)],
        blockchain: "ARC-TESTNET", fee: { type: "level", config: { feeLevel: "LOW" } } });
      const tx = r?.data?.transaction || r?.data;
      if (r?.data?.id || tx?.id) res.status(200).json({ ok: true, id: tx?.id, state: tx?.state });
      else res.status(200).json({ ok: false, error: "send failed", raw: r?.data });
      return;
    }
    res.status(400).json({ error: "unknown action" });
  } catch (e) {
    res.status(200).json({ ok: false, error: e?.message || "failed", code: e?.code });
  }
};
