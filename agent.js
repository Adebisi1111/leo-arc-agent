// AutoSub — Autonomous USDC Subscription Agent on Arc (rate-limit safe)
const { ethers } = require("ethers");
const fs = require("fs");

const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

const SUBS = [
  { name: "X Premium", payee: "0x1111111111111111111111111111111111111111", amount: 8_000_000, interval: 60 },
  { name: "Netflix",   payee: "0x2222222222222222222222222222222222222222", amount: 5_000_000, interval: 90 },
  { name: "Spotify",   payee: "0x3333333333333333333333333333333333333333", amount: 3_000_000, interval: 120 },
];

const VAULT_ABI = [
  "function subscribe(address,uint256,uint256,uint256) returns (uint256)",
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
];
const ERC20_ABI = ["function approve(address,uint256) returns (bool)"];

// resilient provider: pass chainId to skip eth_chainId probe; add retry/backoff
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, n = 5) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      if (String(e.message).includes("request limit")) { await sleep(2000 * (i + 1)); continue; }
      throw e;
    }
  }
  throw new Error("RPC rate limit exhausted");
}

async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
  console.log(`AutoSub agent online: ${wallet.address}`);

  let nextId = Number(await withRetry(() => vault.nextId()));
  if (nextId === 0) {
    console.log("Registering demo subscriptions (X / Netflix / Spotify)...");
    for (const s of SUBS) {
      const tx = await withRetry(() => vault.subscribe(s.payee, s.amount, s.interval, 0));
      await withRetry(() => tx.wait());
      console.log(`  + ${s.name} registered`);
      await sleep(1500);
    }
    nextId = Number(await withRetry(() => vault.nextId()));
  }
  console.log(`Active subscriptions: ${nextId}`);

  // Approve vault once so it can pull USDC for settlement
  const ap = await withRetry(() => usdc.approve(VAULT, ethers.MaxUint256));
  await withRetry(() => ap.wait());
  console.log("Vault approved to spend USDC. Autonomous loop starting...\n");

  setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    for (let id = 0; id < nextId; id++) {
      try {
        const s = await withRetry(() => vault.subs(id));
        if (!s[6]) continue; // inactive
        if (Number(s[5]) <= now) {
          const name = SUBS[id] ? SUBS[id].name : "merchant";
          console.log(`[${new Date().toISOString()}] Due: #${id} ${name} -> ${Number(s[1]) / 1e6} USDC`);
          const tx = await withRetry(() => vault.pay(id));
          const rcpt = await withRetry(() => tx.wait());
          console.log(`  settled tx ${rcpt.hash.slice(0, 18)}...`);
          await sleep(1000);
        }
      } catch (e) {
        if (!String(e.message).includes("request limit")) console.error("sub err", e.message);
      }
    }
  }, 20_000);
}
main().catch((e) => { console.error(e); process.exit(1); });
