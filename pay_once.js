// One-shot: fire a single due payment (pay(1)) to create fresh on-chain activity.
// Uses owner wallet from wallet.json. Same RPC retry/backoff as agent.js.
const { ethers } = require("ethers");
const fs = require("fs");

const RPC = "https://arc-testnet.rpc.thirdweb.com";
const CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const ID = 1; // subs(1) is active + nextDue in the past => legitimately due

const VAULT_ABI = [
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
];
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, n = 8) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      if (String(e.message).includes("request limit") || String(e.message).includes("429")) {
        await sleep(2500 * (i + 1)); continue;
      }
      throw e;
    }
  }
  throw new Error("RPC rate limit exhausted");
}

async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  console.log(`owner wallet: ${wallet.address}`);

  const s = await withRetry(() => vault.subs(ID));
  console.log(`sub #${ID}: active=${s[6]} nextDue=${new Date(Number(s[5])*1000).toISOString()} amount=${Number(s[1])/1e6} USDC`);
  if (!s[6]) { console.log("NOT active — aborting, no forced payment"); return; }
  const now = Math.floor(Date.now()/1000);
  if (Number(s[5]) > now) { console.log("NOT yet due — aborting, no forced payment"); return; }

  console.log(`sub #${ID} is due -> calling pay(${ID})...`);
  const tx = await withRetry(() => vault.pay(ID));
  const rcpt = await withRetry(() => tx.wait());
  console.log(`PAID. tx: ${rcpt.hash}`);
  console.log(`ArcScan: https://testnet.arcscan.app/tx/${rcpt.hash}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
