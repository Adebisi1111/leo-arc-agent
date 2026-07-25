// Concord — fix intervals to 1/day.
// Contract has NO setInterval(), so: cancel short-interval subs (0..5),
// re-subscribe them at 86400s (1/day). Owner-only (wallet.json = vault owner).
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

  const DAY = 86400;

  // capture current payees/amounts for subs 0..5 so we re-create them identically
  const snapshot = [];
  for (const id of [0, 1, 2, 3, 4, 5]) {
    const s = await withRetry(() => vault.subs(id));
    snapshot.push({ id, payee: s[0], amount: s[1], interval: Number(s[2]), cycles: Number(s[3]) });
  }

  // cancel 0..5
  for (const id of [0, 1, 2, 3, 4, 5]) {
    const tx = await withRetry(() => vault.cancel(id));
    const rc = await withRetry(() => tx.wait());
    console.log(`cancelled #${id} tx ${rc.hash.slice(0, 12)}…`);
    await sleep(1000);
  }

  // re-subscribe at 1/day (86400s), infinite cycles (0)
  for (const old of snapshot) {
    const tx = await withRetry(() => vault.subscribe(old.payee, old.amount, DAY, 0));
    const rc = await withRetry(() => tx.wait());
    const newId = Number(rc.logs?.find(() => true) ? await vault.nextId() - 1n : 0);
    console.log(`re-subscribed ${old.payee.slice(0, 10)}… @1/day id=${newId} tx ${rc.hash.slice(0, 12)}…`);
    await sleep(1200);
  }

  // report final state
  const n = Number(await withRetry(() => vault.nextId()));
  console.log(`\nnextId now: ${n}`);
  for (let i = 0; i < n; i++) {
    const s = await withRetry(() => vault.subs(i));
    const iv = Number(s[2]);
    console.log(`#${i} payee=${s[0].slice(0, 8)} amt=${Number(s[1]) / 1e6} interval=${iv}s (${iv >= DAY ? (iv / DAY) + "d" : (iv / 60).toFixed(1) + "m"}) active=${s[6]}`);
  }
  console.log("\nAll re-created subs are now 1/day. Faucet drain stopped.");
}
main().catch((e) => { console.error(String(e).split("\n").slice(0, 6).join("\n")); process.exit(1); });
