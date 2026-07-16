// AutoSub autonomous agent — run script (rate-limit safe, funds + registers + settles)
import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

// Demo merchants (representative payees — X/Netflix/Spotify don't take Arc USDC yet)
const SUBS = [
  { name: "X Premium", payee: "0x1111111111111111111111111111111111111111", amount: 1_000_000, interval: 45 },
  { name: "Netflix",   payee: "0x2222222222222222222222222222222222222222", amount: 1_000_000, interval: 70 },
  { name: "Spotify",   payee: "0x3333333333333333333333333333333333333333", amount: 1_000_000, interval: 100 },
];

const VAULT_ABI = [
  "function subscribe(address,uint256,uint256,uint256) returns (uint256)",
  "function pay(uint256) external",
  "function fund(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
  "function balance() view returns (uint256)",
];
const ERC20_ABI = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 8) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (/request limit|429|SERVER_ERROR/i.test(String(e.message))) { await sleep(2500 * (i + 1)); continue; } throw e; }
  }
  throw new Error("rate limit exhausted");
}

async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
  console.log(`[${ts()}] AutoSub agent online: ${wallet.address}`);

  // 1) fund the vault if empty (vault is the payer source per contract)
  const vaultBal = Number(await retry(() => usdc.balanceOf(VAULT)));
  if (vaultBal < 5_000_000) {
    console.log(`[${ts()}] Vault low (${vaultBal/1e6} USDC) — funding 16 USDC...`);
    const ap = await retry(() => usdc.approve(VAULT, ethers.MaxUint256)); await retry(() => ap.wait());
    const f = await retry(() => vault.fund(16_000_000)); await retry(() => f.wait());
    console.log(`[${ts()}] Vault funded.`);
    await sleep(1500);
  } else {
    console.log(`[${ts()}] Vault already funded (${vaultBal/1e6} USDC).`);
  }

  // 2) register subs if none
  let nextId = Number(await retry(() => vault.nextId()));
  if (nextId === 0) {
    console.log(`[${ts()}] Registering demo subscriptions...`);
    for (const s of SUBS) {
      const tx = await retry(() => vault.subscribe(s.payee, s.amount, s.interval, 0));
      await retry(() => tx.wait());
      console.log(`[${ts()}]   + ${s.name} registered`);
      await sleep(2000);
    }
    nextId = Number(await retry(() => vault.nextId()));
  }
  console.log(`[${ts()}] Active subscriptions: ${nextId}`);
  console.log(`[${ts()}] Autonomous settle loop started (Ctrl+C to stop)\n`);

  // 3) autonomous loop: watch due subs, settle in USDC
  setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    for (let id = 0; id < nextId; id++) {
      try {
        const s = await retry(() => vault.subs(id));
        if (!s[6]) continue;
        if (Number(s[5]) <= now) {
          const name = SUBS[id] ? SUBS[id].name : "merchant";
          console.log(`[${ts()}] DUE: sub #${id} ${name} -> ${Number(s[1])/1e6} USDC`);
          const tx = await retry(() => vault.pay(id));
          const rcpt = await retry(() => tx.wait());
          console.log(`[${ts()}]   SETTLED tx ${rcpt.hash.slice(0, 20)}... vaultBal=${Number(await retry(()=>usdc.balanceOf(VAULT)))/1e6} USDC`);
          await sleep(1500);
        }
      } catch (e) { if (!/request limit/i.test(String(e.message))) console.error("err", e.message); }
    }
  }, 15_000);
}
const ts = () => new Date().toISOString();
main().catch((e) => { console.error(e); process.exit(1); });
