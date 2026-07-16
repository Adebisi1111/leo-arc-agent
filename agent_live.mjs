// AutoSub v5 — Leo, autonomous USDC auto-pay agent (PATIENT + PERSISTENT)
// Fixes:
//  - uses the contract's authoritative subs(id).nextDue (no parallel schedule)
//  - pays at most ONE due sub per tick, tick = 60s (stays under Arc RPC burst limit)
//  - on Arc tx-submission rate-limit (-32011) it backs off 45s and RETRIES,
//    never suicide-exits, so it lands payments as the quota recovers
//  - runs forever (remove the 280s bound); safe to supervise via cron/setsid
import { ethers } from "ethers";
import fs from "fs";

process.on("uncaughtException", (e) => { fs.appendFileSync("agent_crash.log", `\n[${new Date().toISOString()}] UNCAUGHT: ${e.stack || e.message}`); });
process.on("unhandledRejection", (e) => { fs.appendFileSync("agent_crash.log", `\n[${new Date().toISOString()}] UNHANDLED: ${e && e.stack || e}`); });

console.log("LEO SCRIPT LOADED at " + new Date().toISOString());

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const AGENT_NAME = "Leo";
const TICK_MS = 60_000;          // one payment attempt per minute
const BACKOFF_MS = 45_000;       // wait when Arc rejects tx submission (-32011)
const MAX_PAY_ATTEMPTS = 80;     // ~60 min patience per payment; quota recovers well before this

// friendly labels for the demo subs (order matches on-chain ids)
const LABELS = ["Corner Coffee", "Mike's Diner", "Market Grocery", "Corner Coffee", "Mike's Diner", "Market Grocery"];

const VAULT_ABI = [
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
  "function cancel(uint256) external",
];

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString();

// generic RPC reader retry (reads are cheap, short backoff)
async function read(fn, n = 25) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (/request limit|429|SERVER_ERROR|timeout/i.test(String(e.message))) { await sleep(4000 * (i + 1)); continue; } throw e; }
  }
  throw new Error("read rate limit exhausted");
}

// tx SUBMISSION is the throttled one -> long patient backoff, retry forever-ish
async function submit(txFn) {
  for (let i = 0; i < MAX_PAY_ATTEMPTS; i++) {
    try { return await txFn(); }
    catch (e) {
      const m = String(e.message);
      if (/request limit|429|SERVER_ERROR|timeout|-32011/i.test(m)) { await sleep(BACKOFF_MS); continue; }
      throw e; // real error (revert etc.) -> surface it
    }
  }
  throw new Error("tx submission rate-limit exhausted after patience window");
}

async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);

  console.log(`[${ts()}] ${AGENT_NAME} agent ONLINE`);
  console.log(`[${ts()}] owner ${wallet.address} (ERC-8004 #851166)`);
  console.log(`[${ts()}] vault ${VAULT} | tick ${TICK_MS / 1000}s | backoff ${BACKOFF_MS / 1000}s`);
  console.log(`[${ts()}] reading on-chain nextDue (authoritative schedule)\n`);

  const nextId = Number(await read(() => vault.nextId()));
  let cycle = 0;

  async function tick() {
    cycle++;
    const now = Math.floor(Date.now() / 1000);
    // find the first truly-due sub per the contract
    for (let id = 0; id < nextId; id++) {
      const s = await read(() => vault.subs(id));
      const [payee, , , cycles, paid, nextDue, active] = s;
      if (!active) continue;
      if (cycles !== 0n && paid >= cycles) continue;
      if (now < Number(nextDue)) continue;

      const name = LABELS[id] || `merchant${id}`;
      console.log(`[${ts()}] due: ${name} (id ${id}) cycle=${Number(paid) + 1} -> ${payee.slice(0, 8)}…`);
      try {
        const tx = await submit(() => vault.pay(id));
        const rcpt = await read(() => tx.wait(), 40);
        console.log(`[${ts()}]   PAID sub ${id}: https://testnet.arcscan.app/tx/${rcpt.hash}`);
      } catch (e) {
        console.log(`[${ts()}]   pay failed (will retry next tick): ${e.message}`);
      }
      return; // exactly one payment attempt per tick
    }
    console.log(`[${ts()}] cycle ${cycle}: nothing due right now`);
  }

  await tick();
  setInterval(async () => {
    try { await tick(); }
    catch (e) { console.error(`[${ts()}] tick error: ${e.message}`); }
  }, TICK_MS);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
