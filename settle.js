// Concord — Autonomous Settlement Agent (one-shot, schedule-friendly)
// Wakes up, finds due subscriptions, tops up the vault if low, pays them all, exits.
// Designed to run on a cron/schedule — no long-lived process needed.
const { ethers } = require("ethers");
const fs = require("fs");

const RPC = "https://arc-testnet.rpc.thirdweb.com";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

const VAULT_ABI = [
  "function fund(uint256) external",
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, n = 12) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      const m = String(e.message);
      if (m.includes("request limit") || m.includes("429") || m.includes("timeout") || m.includes("throttl")) {
        await sleep(2500 * (i + 1)); continue;
      }
      throw e;
    }
  }
  throw new Error("RPC retries exhausted");
}

const BALANCE_BUFFER = 3_000_000n; // keep >= 3 USDC in vault

async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

  console.log(`[${new Date().toISOString()}] Concord settle waking — owner ${wallet.address}`);

  // ensure vault is approved to pull USDC from owner (only if not already maxed)
  const allowance = BigInt(await withRetry(() => usdc.allowance(wallet.address, VAULT)));
  if (allowance < ethers.MaxUint256 / 2n) {
    const ap = await withRetry(() => usdc.approve(VAULT, ethers.MaxUint256));
    await withRetry(() => ap.wait());
  }

  const nextId = Number(await withRetry(() => vault.nextId()));
  const now = Math.floor(Date.now() / 1000);

  // gather due subs
  const due = [];
  for (let id = 0; id < nextId; id++) {
    const s = await withRetry(() => vault.subs(id));
    if (s[6] && Number(s[5]) <= now) {
      due.push({ id, payee: s[0], amount: BigInt(s[1]) });
    }
  }

  if (due.length === 0) {
    console.log("Nothing due. Agent idle.");
    return;
  }

  const totalDue = due.reduce((a, d) => a + d.amount, 0n);
  let vaultBal = BigInt(await withRetry(() => usdc.balanceOf(VAULT)));
  console.log(`Due: ${due.length} subs, total ${Number(totalDue) / 1e6} USDC. Vault has ${Number(vaultBal) / 1e6} USDC.`);

  // top up vault if it can't cover the cycle (+ buffer)
  if (vaultBal < totalDue + BALANCE_BUFFER) {
    const need = totalDue + BALANCE_BUFFER - vaultBal;
    const ftx = await withRetry(() => vault.fund(need));
    const frc = await withRetry(() => ftx.wait());
    vaultBal = BigInt(await withRetry(() => usdc.balanceOf(VAULT)));
    console.log(`Funded vault +${Number(need) / 1e6} USDC (tx ${frc.hash.slice(0, 12)}…). Vault now ${Number(vaultBal) / 1e6} USDC.`);
  }

  // pay every due sub
  let paid = 0;
  for (const d of due) {
    try {
      const tx = await withRetry(() => vault.pay(d.id));
      const rcpt = await withRetry(() => tx.wait());
      paid++;
      console.log(`  paid #${d.id} ${Number(d.amount) / 1e6} USDC -> ${d.payee.slice(0, 10)}… (tx ${rcpt.hash.slice(0, 12)}…)`);
      console.log(`NOTIFY|#${d.id}|${d.payee}|${(Number(d.amount) / 1e6).toFixed(2)} USDC|${rcpt.hash}`);
      await sleep(1200); // breathing room between sends
    } catch (e) {
      console.error(`  FAILED #${d.id}: ${String(e.message).split("\n")[0]}`);
    }
  }
  console.log(`[${new Date().toISOString()}] Settled ${paid}/${due.length} due subscriptions. Done.`);
}

main().catch((e) => { console.error(String(e).split("\n").slice(0, 8).join("\n")); process.exit(1); });
