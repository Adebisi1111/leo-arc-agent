// reregister.mjs — ONE-TX-PER-RUN, resumable. Fixes the "6 dues" demo problem:
//   Phase 1: cancel any still-active old subs (ids 0..5)  [tiny 40/60/90s intervals]
//   Phase 2: subscribe exactly 3 realistic subs (ids 6,7,8) with 1d/3d/7d intervals
// Each run does at most ONE tx (patient retry on Arc -32011) then exits, so it
// never bursts the RPC. Run it repeatedly (or via cron) until it reports DONE.
import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const dir = "C:/Users/Administrator/arc-autopay";
const pk = fs.readFileSync(dir + "/wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const p = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const ts = () => new Date().toISOString();
const isThrottle = (m) => /-32011|request limit|429|timeout|SERVER_ERROR/i.test(String(m));

const vault = new ethers.Contract(VAULT, [
  "function cancel(uint256) external",
  "function subscribe(address,uint256,uint256,uint256) external returns(uint256)",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns(uint256)",
], w);

const PAYEES = {
  6: "0x1111111111111111111111111111111111111111", // Corner Coffee
  7: "0x2222222222222222222222222222222222222222", // Mike's Diner
  8: "0x3333333333333333333333333333333333333333", // Market Grocery
};
const INTERVALS = { 6: 86400, 7: 259200, 8: 604800 }; // 1d, 3d, 7d
const NAMES = { 6: "Corner Coffee", 7: "Mike's Diner", 8: "Market Grocery" };

async function sendTx(fn) {
  for (let i = 0; i < 60; i++) {
    try { const tx = await fn(); const r = await tx.wait(); return r; }
    catch (e) { if (isThrottle(e.message)) { console.log(`[${ts()}] throttled, waiting 45s (${i + 1})`); await new Promise(r => setTimeout(r, 45000)); continue; } throw e; }
  }
  throw new Error("throttle exhausted");
}

async function main() {
  const nextId = Number(await vault.nextId());

  // Phase 1: cancel lowest still-active old sub (ids 0..5)
  for (let id = 0; id < 6; id++) {
    const s = await vault.subs(id);
    if (s[6]) { // active
      const r = await sendTx(() => vault.cancel(id));
      console.log(`[${ts()}] CANCELLED old sub #${id} tx ${r.hash}`);
      return; // one tx this run
    }
  }

  // Phase 2: subscribe next realistic sub (ids 6,7,8)
  const nextNew = Math.max(6, nextId);
  if (nextNew <= 8) {
    const r = await sendTx(() => vault.subscribe(PAYEES[nextNew], 1_000_000n, INTERVALS[nextNew], 0));
    console.log(`[${ts()}] SUBSCRIBED ${NAMES[nextNew]} (id ${nextNew}) every ${INTERVALS[nextNew]}s tx ${r.hash}`);
    return; // one tx this run
  }

  console.log(`[${ts()}] DONE: 6 old cancelled, 3 realistic subs (1d/3d/7d) registered.`);
}

main().catch((e) => { console.error(`[${ts()}] ERROR ${e.message}`); process.exit(1); });
