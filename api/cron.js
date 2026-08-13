// Vercel Cron: runs on schedule, settles all due agents from their balance.
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { load } from "./store.js";

const TOKEN = "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";
const INTERVAL_MS = { "1 hour": 3600e3, "1 day": 86400e3, "1 week": 604800e3 };

export default async function handler(req, res) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>; allow if secret matches or absent in dev
  const auth = req.headers.authorization || "";
  const secret = process.env.CRON_SECRET;
  if (secret && !auth.includes(secret)) return res.status(401).json({ error: "unauthorized" });

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });

  const db = load();
  const agents = db.agents || {};
  const now = Date.now();
  const log = [];

  for (const [addr, cfg] of Object.entries(agents)) {
    const gap = INTERVAL_MS[cfg.interval] || INTERVAL_MS["1 day"];
    const last = cfg.lastRun ? new Date(cfg.lastRun).getTime() : 0;
    if (now - last < gap) continue; // not due yet

    try {
      const list = await client.listWallets({ blockchains: ["ARC-TESTNET"] });
      const w = list.data.wallets.find((x) => x.address.toLowerCase() === addr.toLowerCase());
      if (!w) { log.push({ addr, skip: "wallet not found" }); continue; }

      const bal = await client.getWalletTokenBalance({ id: w.id, tokenId: TOKEN });
      const avail = parseFloat(bal.data.tokenBalances?.[0]?.amount || "0");
      const need = cfg.recipients.reduce((s, r) => s + parseFloat(r.amt), 0);
      if (avail < need) { log.push({ addr, skip: `insufficient balance ${avail} < ${need}` }); continue; }

      const results = [];
      for (const r of cfg.recipients) {
        try {
          const tx = await client.createTransaction({
            walletId: w.id, tokenId: TOKEN, destinationAddress: r.addr,
            amount: [String(r.amt)], fee: { type: "level", config: { feeLevel: "MEDIUM" } },
          });
          results.push({ to: r.addr, amt: r.amt, id: tx.data.id });
        } catch (e) { results.push({ to: r.addr, amt: r.amt, error: e.message }); }
      }
      cfg.lastRun = new Date().toISOString();
      log.push({ addr, settled: results });
    } catch (e) {
      log.push({ addr, error: e.message });
    }
  }

  // persist updated lastRun
  try { const { save } = await import("./store.js"); save(db); } catch {}

  return res.json({ ok: true, ran: new Date().toISOString(), log });
}
