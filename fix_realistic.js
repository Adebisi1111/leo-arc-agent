// Concord — make intervals realistic.
// Contract has no setInterval(), so: read each sub's payee+amount, cancel all,
// re-subscribe with realistic, varied intervals (daily heartbeat + weekly/biweekly/monthly).
// Owner-only (wallet.json = vault owner). One-shot.
const { ethers } = require("ethers");
const fs = require("fs");

const RPC = "https://arc-testnet.rpc.thirdweb.com";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

const VAULT_ABI = [
  "function cancel(uint256) external",
  "function subscribe(address,uint256,uint256,uint256) returns (uint256)",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
];

// Realistic cadence per original sub id (seconds). 0 = infinite cycles.
const NEW_INTERVAL = {
  0: 86400,     // daily — the live "heartbeat" payment
  1: 604800,    // weekly
  2: 691200,    // weekly (8d, staggered)
  3: 1209600,   // biweekly
  4: 2592000,   // monthly (30d)
  5: 2678400,   // monthly (31d, staggered)
  6: 604800,    // weekly (was daily -> now weekly)
  7: 2764800,   // monthly (32d, staggered)
  8: 2592000,   // monthly
  9: 604800,    // weekly (was daily -> now weekly)
};

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

async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  console.log(`owner: ${wallet.address}`);

  const n = Number(await withRetry(() => vault.nextId()));
  console.log(`capturing ${n} existing subs...`);

  // capture payee + amount (keep them; only interval changes)
  const captured = [];
  for (let id = 0; id < n; id++) {
    const s = await withRetry(() => vault.subs(id));
    captured.push({ payee: s[0], amount: s[1] });
  }

  // cancel all
  for (let id = 0; id < n; id++) {
    const tx = await withRetry(() => vault.cancel(id));
    const rc = await withRetry(() => tx.wait());
    console.log(`cancelled #${id} tx ${rc.hash.slice(0, 12)}…`);
    await sleep(1000);
  }

  // re-subscribe with realistic intervals
  for (let id = 0; id < n; id++) {
    const iv = NEW_INTERVAL[id];
    const tx = await withRetry(() => vault.subscribe(captured[id].payee, captured[id].amount, iv, 0));
    const rc = await withRetry(() => tx.wait());
    const newId = Number(await withRetry(() => vault.nextId())) - 1;
    const label = iv >= 2592000 ? `${(iv / 2592000).toFixed(0)}mo` : iv >= 1209600 ? "biweekly" : iv >= 604800 ? "weekly" : "daily";
    console.log(`#${newId} ${captured[id].payee.slice(0, 10)}… ${Number(captured[id].amount) / 1e6} USDC ${label} (${iv}s)`);
    await sleep(1200);
  }

  // final report
  const n2 = Number(await withRetry(() => vault.nextId()));
  console.log(`\n=== final state (${n2} subs) ===`);
  let dailyBurn = 0;
  for (let i = 0; i < n2; i++) {
    const s = await withRetry(() => vault.subs(i));
    const iv = Number(s[2]);
    const amt = Number(s[1]) / 1e6;
    if (iv <= 86400) dailyBurn += amt;
    const label = iv >= 2592000 ? `${(iv / 2592000).toFixed(0)}mo` : iv >= 1209600 ? "biweekly" : iv >= 604800 ? "weekly" : "daily";
    console.log(`#${i} ${s[0].slice(0, 8)} ${amt} USDC ${label} active=${s[6]}`);
  }
  console.log(`\nApprox daily USDC outflow: ~${dailyBurn.toFixed(2)} (only the daily sub) + weekly/monthly averages. Faucet drain stopped.`);
}
main().catch((e) => { console.error(String(e).split("\n").slice(0, 6).join("\n")); process.exit(1); });
