// Per-user Arc agent: get/create/fund/balance using session cookie
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "fs";

const TOKEN = "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";
const POOL = "a4fb2d3f"; // main pool wallet id
const DB = "/tmp/concord-users.json";
function load() { try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return {}; } }
function save(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }
function getSession(req) {
  const c = req.headers.cookie?.split("; ").find((r) => r.startsWith("concord_sess="));
  if (!c) return null;
  try { return JSON.parse(Buffer.from(c.split("=")[1], "base64url").toString()); } catch { return null; }
}
const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY, entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

export default async function handler(req, res) {
  const u = getSession(req);
  if (!u) return res.status(401).json({ error: "not logged in" });
  // derive user from session (address + walletId), do not trust ephemeral server DB
  const user = { sub: u.sub, email: u.email, address: u.address, walletId: u.walletId };

  const action = new URL(req.url, "https://arc-autopay.vercel.app").searchParams.get("action");

  try {
    if (action === "balance") {
      // always resolve wallet by session address (authoritative, survives stale walletId)
      const list = await client.listWallets({ blockchains: ["ARC-TESTNET"] });
      const w = list.data.wallets.find((x) => x.address.toLowerCase() === user.address.toLowerCase());
      if (!w) return res.status(404).json({ error: "wallet not found for address", address: user.address });
      const b = await client.getWalletTokenBalance({ id: w.id, tokenId: TOKEN });
      const amt = b.data.tokenBalances?.[0]?.amount || "0";
      return res.json({ ok: true, balance: amt, address: user.address });
    }
    if (action === "history") {
      const list = await client.listWallets({ blockchains: ["ARC-TESTNET"] });
      const w = list.data.wallets.find((x) => x.address.toLowerCase() === user.address.toLowerCase());
      if (!w) return res.status(404).json({ error: "wallet not found" });
      const tx = await client.listTransactions({ walletIds: [w.id], pageSize: 25 });
      const rows = (tx.data.transactions || []).map((t) => ({
        id: t.id,
        type: t.transactionType,
        state: t.state,
        amount: t.amounts?.[0] || "0",
        to: t.destinationAddress,
        from: t.sourceAddress,
        hash: t.txHash,
        date: t.createDate || t.updateDate,
      }));
      return res.json({ ok: true, txs: rows, address: user.address });
    }
    if (action === "send") {
      // execute real outbound transfers to recipients from the agent wallet
      const list = await client.listWallets({ blockchains: ["ARC-TESTNET"] });
      const w = list.data.wallets.find((x) => x.address.toLowerCase() === user.address.toLowerCase());
      if (!w) return res.status(404).json({ error: "wallet not found for address", address: user.address });
      let body = "";
      try { body = await new Promise((r) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => r(d)); }); } catch {}
      const payload = body ? JSON.parse(body) : {};
      const recips = Array.isArray(payload.recipients) ? payload.recipients : [];
      const interval = payload.interval || "1 day";
      // resolve each recipient ref (gmail or 0x) to an address + token
      const { resolve } = await import("./directory.js");
      const TOKENS = {
        USDC: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
        EURC: process.env.EURC_TOKEN_ID || "EURC_PENDING",
      };
      const resolved = [];
      for (const r of recips) {
        const ref = r.addr || r.gmail || "";
        let addr = ref.startsWith("0x") ? ref : await resolve(ref);
        if (!addr) { resolved.push({ ...r, addr: ref, error: "recipient not found (no wallet for " + ref + ")" }); continue; }
        const sym = (r.token || "USDC").toUpperCase();
        resolved.push({ addr, amt: r.amt, token: sym, tokenId: TOKENS[sym] });
      }
      const valid = resolved.filter((r) => r.addr && r.addr.startsWith("0x") && parseFloat(r.amt) > 0 && r.tokenId && r.tokenId !== "EURC_PENDING");
      if (!valid.length) return res.status(400).json({ error: "no valid recipients", resolved });
      // persist agent config for autonomous cron
      try {
        const { load, save } = await import("./store.js");
        const db = load();
        db.agents = db.agents || {};
        db.agents[user.address] = {
          email: user.email, address: user.address,
          recipients: resolved, interval, lastRun: new Date().toISOString(),
        };
        save(db);
      } catch (e) {}
      const results = [];
      for (const r of valid) {
        try {
          const tx = await client.createTransaction({
            walletId: w.id,
            tokenId: r.tokenId,
            destinationAddress: r.addr,
            amount: [String(r.amt)],
            fee: { type: "level", config: { feeLevel: "MEDIUM" } },
          });
          results.push({ to: r.addr, token: r.token, amt: r.amt, id: tx.data.id, state: tx.data.state });
        } catch (e) {
          results.push({ to: r.addr, token: r.token, amt: r.amt, error: e.message });
        }
      }
      return res.json({ ok: true, results, interval });
    }
    if (action === "fund") {
      // resolve wallet by session address (authoritative)
      const list = await client.listWallets({ blockchains: ["ARC-TESTNET"] });
      const w = list.data.wallets.find((x) => x.address.toLowerCase() === user.address.toLowerCase());
      if (!w) return res.status(404).json({ error: "wallet not found for address", address: user.address });
      // faucet forbidden on Arc; fund from pool
      const f = await client.createTransaction({
        walletId: POOL,
        tokenId: TOKEN,
        destinationAddress: user.address,
        amount: ["1"],
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      });
      return res.json({ ok: true, id: f.data.id, state: f.data.state, note: "funded 1 USDC from pool" });
    }
    return res.json({ ok: true, address: user.address, walletId: user.walletId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
