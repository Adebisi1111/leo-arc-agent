// leo_cron.mjs — ONE durable tick, ONE tx max, run every 20 min by cron.
// Priority per run (so the "6 dues" fix happens before new payments):
//   1. cancel one still-active OLD sub (ids 0..5, tiny 40/60/90s intervals)
//   2. subscribe one REALISTIC new sub (ids 6/7/8 = 1d/3d/7d)
//   3. fund vault if < 2 USDC
//   4. pay one due sub
// One tx/run keeps us under Arc's -32011 sliding throttle. Silent when idle.
import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const USDC = "0x3600000000000000000000000000000000000000";
const FUND_AMT = 10_000_000n;
const MIN_VAULT = 2_000_000n;
const dir = "C:/Users/Administrator/arc-autopay";
const pk = fs.readFileSync(dir + "/wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const p = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const ts = () => new Date().toISOString();
const isThrottle = (m) => /-32011|request limit|429|timeout|SERVER_ERROR/i.test(String(m));

const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns(uint256)", "function allowance(address,address) view returns(uint256)", "function approve(address,uint256) returns(bool)"], w);
const vault = new ethers.Contract(VAULT, [
  "function cancel(uint256) external",
  "function subscribe(address,uint256,uint256,uint256) external returns(uint256)",
  "function pay(uint256) external",
  "function fund(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns(uint256)",
], w);

const PAYEES = { 6: "0x1111111111111111111111111111111111111111", 7: "0x2222222222222222222222222222222222222222", 8: "0x3333333333333333333333333333333333333333" };
const INTERVALS = { 6: 86400, 7: 259200, 8: 604800 }; // 1d, 3d, 7d
const NAMES = { 6: "Corner Coffee", 7: "Mike's Diner", 8: "Market Grocery" };
const LABELS = ["Corner Coffee", "Mike's Diner", "Market Grocery", "Corner Coffee", "Mike's Diner", "Market Grocery"];

async function sendTx(fn, label) {
  for (let i = 0; i < 60; i++) {
    try { const tx = await fn(); const r = await tx.wait(); console.log(`[${ts()}] ${label} -> tx ${r.hash}`); return true; }
    catch (e) { if (isThrottle(e.message)) { console.log(`[${ts()}] ${label}: throttled, retry next run`); return false; } throw e; }
  }
  console.log(`[${ts()}] ${label}: throttle exhausted`); return false;
}

async function main() {
  const nextId = Number(await vault.nextId());

  // 1) cancel oldest active OLD sub
  for (let id = 0; id < 6; id++) {
    const s = await vault.subs(id);
    if (s[6]) { await sendTx(() => vault.cancel(id), `CANCEL old sub #${id}`); return; }
  }
  // 2) subscribe next REALISTIC sub
  const nextNew = Math.max(6, nextId);
  if (nextNew <= 8) { await sendTx(() => vault.subscribe(PAYEES[nextNew], 1_000_000n, INTERVALS[nextNew], 0), `SUBSCRIBE ${NAMES[nextNew]} (${INTERVALS[nextNew]}s)`); return; }

  // 3) fund if low
  const vaultBal = await usdc.balanceOf(VAULT);
  if (vaultBal < MIN_VAULT) {
    const allow = await usdc.allowance(w.address, VAULT);
    if (allow < FUND_AMT) { if (!(await sendTx(() => usdc.approve(VAULT, FUND_AMT * 100n), "approve vault"))) return; }
    if (await sendTx(() => vault.fund(FUND_AMT), "FUND vault +10 USDC")) return; else return;
  }

  // 4) pay one due sub
  const now = Math.floor(Date.now() / 1000);
  for (let id = 0; id < nextId; id++) {
    const s = await vault.subs(id);
    const [payee, , , cycles, paid, nextDue, active] = s;
    if (!active) continue;
    if (cycles !== 0n && paid >= cycles) continue;
    if (now < Number(nextDue)) continue;
    await sendTx(() => vault.pay(id), `LEO PAID ${LABELS[id] || id} (id ${id})`);
    return;
  }
  // nothing to do -> silent
}

main().catch((e) => { console.error(`[${ts()}] ERROR ${e.message}`); process.exit(1); });
