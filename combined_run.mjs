// combined_run.mjs — runs BOTH the monitor and a patient payer in ONE process,
// so they stay alive together for the duration of a single foreground command.
// If Arc's tx throttle lifts, pay() lands and the monitor prints the settlement.
import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const PK = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const wallet = new ethers.Wallet(PK, provider);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString();

const VAULT_ABI = [
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
  "event Paid(uint256,address,uint256,uint256)",
];
const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
const iface = new ethers.Interface(VAULT_ABI);

async function main() {
  console.log(`[${ts()}] === Leo combined run (monitor + patient payer) ===`);
  let lastBlock = 0;
  try { lastBlock = (await provider.getBlockNumber()) - 2; } catch {}
  let nextId = 1;
  try { nextId = Number(await vault.nextId()); } catch {}

  const MONITOR_MS = 12_000;
  const PAY_MS = 60_000;       // one pay attempt per minute
  let lastPay = 0;

  async function monitor() {
    try {
      const head = await provider.getBlockNumber();
      const from = Math.max(lastBlock, head - 200);
      const logs = await provider.getLogs({ address: VAULT, fromBlock: from, toBlock: head });
      for (const l of logs) {
        try {
          const d = iface.parseLog(l);
          if (d.name === "Paid") {
            console.log(`[${ts()}] LEO PAID sub#${d.args[0]} -> ${d.args[1].slice(0,8)}… ${ethers.formatUnits(d.args[2],6)} USDC | block ${l.blockNumber}`);
            console.log(`         https://testnet.arcscan.app/tx/${l.transactionHash}`);
          }
        } catch {}
      }
      lastBlock = head;
    } catch (e) { /* throttle on reads is transient */ }
  }

  async function maybePay() {
    const now = Date.now();
    if (now - lastPay < PAY_MS) return;
    lastPay = now;
    try {
      const id = 0;
      const s = await vault.subs(id);
      const [, , , cycles, paid, nextDue, active] = s;
      if (!active || (cycles !== 0n && paid >= cycles) || Math.floor(now/1000) < Number(nextDue)) {
        console.log(`[${ts()}] pay check: nothing due right now`);
        return;
      }
      console.log(`[${ts()}] attempting pay(${id})...`);
      const tx = await vault.pay(id);
      const rcpt = await tx.wait();
      console.log(`[${ts()}] >>> PAYMENT SENT tx ${rcpt.hash} block ${rcpt.blockNumber} <<<`);
    } catch (e) {
      const m = String(e.message);
      if (/request limit|-32011|429/i.test(m)) console.log(`[${ts()}] Arc throttle (-32011): will retry next minute`);
      else console.log(`[${ts()}] pay error: ${m.slice(0,120)}`);
    }
  }

  console.log(`[${ts()}] watching ${VAULT} | pay target id=0 | interval monitor=12s pay=60s`);
  // initial
  await monitor(); await maybePay();
  const tMon = setInterval(monitor, MONITOR_MS);
  const tPay = setInterval(maybePay, PAY_MS);
  // run until killed by the foreground command timeout
  await new Promise(() => {});
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
