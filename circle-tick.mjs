import { dcw } from "./circle-client.mjs";
import { ethers } from "ethers";
import fs from "fs";

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const USDC = "0x3600000000000000000000000000000000000000";
const WALLET_ID = process.env["CIRCLE_WALLET_ID"];
const WHALE = process.env["CIRCLE_WALLET_ADDRESS"];
const RPC = "https://rpc.testnet.arc.network";
const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const vault = new ethers.Contract(VAULT, [
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns(uint256)",
], p);
const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns(uint256)"], p);
const ts = () => new Date().toISOString();
const withTimeout = (pr, ms, label) => Promise.race([pr, new Promise((_,r)=>setTimeout(()=>r(new Error(label+" TIMEOUT")),ms))]);

// Named subs are the "real" payroll ones; unnamed ones are deprecated test subs we skip paying.
let NAMED = {};
try { NAMED = JSON.parse(fs.readFileSync("subs-meta.json", "utf8")); } catch {}

// Always log to file; only report to stdout (chat) when Concord acts.
const LOG = "circle-tick.log";
const fileLog = (s) => { try { fs.appendFileSync(LOG, `[${ts()}] ${s}\n`); } catch {} };
let acted = false;
const report = (s) => { acted = true; fileLog(s); console.log(`[${ts()}] ${s}`); };
const note = (s) => { fileLog(s); };

async function circleWalletUsdc() {
  try {
    const r = await dcw.getWalletTokenBalance({ id: WALLET_ID, tokenId: "USDC" });
    const tb = r.data.tokenBalances.find(t => t.token.tokenAddress && t.token.tokenAddress.toLowerCase() === USDC.toLowerCase());
    return Number((tb ? tb.amount : "0")) * 1e6;
  } catch(e){ note(`Circle balance read failed: ${e.message}`); return 0; }
}

async function exec(sig, params, amtLabel) {
  const r = await dcw.createContractExecutionTransaction({
    walletId: WALLET_ID, contractAddress: (sig.startsWith("pay") ? VAULT : USDC),
    abiFunctionSignature: sig, abiParameters: params,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  report(`EXEC ${amtLabel} -> Circle tx ${r.data.id} (${r.data.state})`);
  return r.data.id;
}

async function main() {
  let vaultBal = 0;
  try { vaultBal = Number(await withTimeout(usdc.balanceOf(VAULT), 10000, "vaultRead")); } catch(e){ note(`vault read failed: ${e.message}`); }
  const walletBal = await circleWalletUsdc();
  note(`vault=${(vaultBal/1e6).toFixed(2)} USDC, circleWallet=${(walletBal/1e6).toFixed(2)} USDC`);

  if (vaultBal < 2_000_000 && walletBal > 5_000_000) {
    await exec("transfer(address,uint256)", [VAULT, "5000000"], "fund vault 5 USDC");
    return;
  }
  if (walletBal < 300_000) { note("circle wallet low on gas, skipping"); return; }

  let target = -1;
  let mostOverdue = Infinity;
  try {
    const nextId = Number(await withTimeout(vault.nextId(), 10000, "nextIdRead"));
    const now = Math.floor(Date.now()/1000);
    for (let id=nextId-1; id>=0; id--){
      const s = await withTimeout(vault.subs(id), 8000, "subsRead");
      const [, , , cycles, paid, nextDue, active] = s;
      if (!active) continue;
      if (cycles!==0n && paid>=cycles) continue;
      if (now < Number(nextDue)) continue;
      if (!NAMED[String(id)]) continue; // skip deprecated/unnamed test subs
      // pick the MOST overdue named sub so the daily anchor is always serviced first
      if (Number(nextDue) < mostOverdue) { mostOverdue = Number(nextDue); target = id; }
    }
  } catch(e){ note(`due-detection read failed: ${e.message}, defaulting to a named anchor sub`);
    // fallback: pick the daily anchor (#9) or first named sub we know, never an unnamed test sub
    target = NAMED["9"] ? 9 : (Object.keys(NAMED).map(Number).sort((a,b)=>a-b)[0] ?? -1);
  }

  if (target < 0) { note("nothing due"); return; }
  await exec("pay(uint256)", [String(target)], `pay sub#${target}`);
}
try { await main(); } catch(e) { report("ERR " + (e.response ? JSON.stringify(e.response.data) : e.message)); }
// Refresh the human-readable dashboard data (best-effort; never fail the tick on this).
try { await import("./build-state.mjs"); } catch(e) { note("build-state skip: " + e.message); }
if (!acted) process.exit(0);
