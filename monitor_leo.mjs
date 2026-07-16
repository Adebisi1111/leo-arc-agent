// monitor_leo.mjs — real-time watchability for Leo's settlements (FREE, no Circle API key)
// Polls the Vault's `Paid` event on the public Arc RPC and prints each payment as
// it lands. Equivalent to the Circle "Monitor contract events" tutorial, minus the
// managed-webhook account requirement.
//
// Arc-specific note: Arc's eth_getLogs REJECTS a toBlock beyond the current head
// ("block range extends beyond current head block"), so we cap toBlock at head-1.
import { ethers } from "ethers";

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

// merchant labels keyed by subscription id (mirrors agent_live.mjs)
const SUBS = ["Corner Coffee", "Mike's Diner", "Market Grocery", "Corner Coffee", "Mike's Diner", "Market Grocery"];

// REAL event from SubscriptionVault.sol line 37:
//   event Paid(uint256 id, address payee, uint256 amount, uint256 cycle);
const EVENT_ABI = "event Paid(uint256 id, address payee, uint256 amount, uint256 cycle)";
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const vault = new ethers.Contract(VAULT, [EVENT_ABI], provider);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 40) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      const m = String(e.message);
      if (/request limit|429|SERVER_ERROR|timeout|beyond current head/i.test(m)) { await sleep(8000 * (i + 1)); continue; }
      throw e;
    }
  }
  throw new Error("rate limit exhausted");
}

const ts = () => new Date().toISOString();

async function main() {
  console.log(`[${ts()}] Leo event monitor ONLINE — watching ${VAULT}`);
  console.log(`[${ts()}] Polling Paid(...) every 12s (free RPC, no Circle key)\n`);

  const filter = vault.filters.Paid();
  // start a few blocks back; cap toBlock at head-1 to satisfy Arc's getLogs rule
  let lastBlock = (await retry(() => provider.getBlockNumber())) - 4;

  setInterval(async () => {
    try {
      const head = await retry(() => provider.getBlockNumber());
      const end = Math.max(lastBlock + 1, head - 1);
      if (end <= lastBlock) return;
      const logs = await retry(() => vault.queryFilter(filter, lastBlock + 1, end));
      for (const log of logs) {
        const { id, payee, amount, cycle } = log.args;
        const name = SUBS[Number(id)] || `merchant${id}`;
        const usdc = Number(amount) / 1e6;
        console.log(`[${ts()}] LEO PAID ${name} — ${usdc} USDC → ${payee} | sub#${id} cycle=${cycle} | block ${log.blockNumber}`);
        console.log(`           ↳ https://testnet.arcscan.app/tx/${log.transactionHash}`);
      }
      lastBlock = end;
    } catch (e) {
      if (!/rate limit|beyond current head/i.test(String(e.message))) console.error("monitor err:", e.message);
    }
  }, 12_000);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
