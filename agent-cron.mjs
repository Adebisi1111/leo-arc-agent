// VPS-based autonomous agent runner.
// Reads agents.json from GitHub repo (written by Vercel on Activate),
// settles due agents from their Arc balance, updates lastRun, pushes back.
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { execSync } from "child_process";

const TOKEN = "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";
const REPO = "Adebisi1111/leo-arc-agent";
const PATH = "agents.json";
const INTERVAL_MS = { "1 hour": 3600e3, "1 day": 86400e3, "1 week": 604800e3 };

function gh(cmd) { return execSync(`gh api ${cmd}`, { encoding: "utf8" }); }
function load() {
  try { const j = JSON.parse(gh(`repos/${REPO}/contents/${PATH}`)); return JSON.parse(Buffer.from(j.content, "base64").toString()); }
  catch { return { agents: {} }; }
}
function save(db) {
  try {
    let sha; try { sha = JSON.parse(gh(`repos/${REPO}/contents/${PATH}`)).sha; } catch {}
    const body = JSON.stringify({ message: "cron: update lastRun", content: Buffer.from(JSON.stringify(db, null, 2)).toString("base64"), ...(sha ? { sha } : {}) });
    execSync(`gh api repos/${REPO}/contents/${PATH} -X PUT --input -`, { input: body, encoding: "utf8" });
  } catch {}
}

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY, entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

async function main() {
  const db = load();
  const agents = db.agents || {};
  const now = Date.now();
  const log = [];

  const TOKENS = { USDC: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8", EURC: process.env.EURC_TOKEN_ID || "4ea52a96-e6ae-56dc-8336-385bb238755f" };

  for (const [addr, cfg] of Object.entries(agents)) {
    const gap = INTERVAL_MS[cfg.interval] || INTERVAL_MS["1 day"];
    const last = cfg.lastRun ? new Date(cfg.lastRun).getTime() : 0;
    if (now - last < gap) { log.push({ addr, note: "not due" }); continue; }

    try {
      const list = await client.listWallets({ blockchains: ["ARC-TESTNET"] });
      const w = list.data.wallets.find((x) => x.address.toLowerCase() === addr.toLowerCase());
      if (!w) { log.push({ addr, skip: "wallet not found" }); continue; }

      // check balance per token used
      const recips = cfg.recipients || [];
      let skip = false;
      for (const r of recips) {
        const sym = (r.token || "USDC").toUpperCase();
        const tid = TOKENS[sym];
        if (!tid) { log.push({ addr, skip: `unknown token ${sym}` }); skip = true; break; }
        const bal = await client.getWalletTokenBalance({ id: w.id, tokenId: tid });
        const avail = parseFloat(bal.data.tokenBalances?.[0]?.amount || "0");
        if (avail < parseFloat(r.amt)) { log.push({ addr, skip: `insufficient ${sym} ${avail} < ${r.amt}` }); skip = true; break; }
      }
      if (skip) continue;

      const results = [];
      for (const r of recips) {
        const sym = (r.token || "USDC").toUpperCase();
        const tid = TOKENS[sym];
        try {
          const tx = await client.createTransaction({
            walletId: w.id, tokenId: tid, destinationAddress: r.addr,
            amount: [String(r.amt)], fee: { type: "level", config: { feeLevel: "MEDIUM" } },
          });
          results.push({ to: r.addr, amt: r.amt, id: tx.data.id, state: tx.data.state });
        } catch (e) { results.push({ to: r.addr, amt: r.amt, error: e.message }); }
      }
      cfg.lastRun = new Date().toISOString();
      log.push({ addr, settled: results });
    } catch (e) { log.push({ addr, error: e.message }); }
  }
  save(db);
  console.log(JSON.stringify({ ran: new Date().toISOString(), log }, null, 2));
}
main();
