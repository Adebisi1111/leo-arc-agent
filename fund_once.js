// Fund the vault so the due payment can execute, then fire pay(1).
// Owner wallet (wallet.json) -> approves + funds vault -> calls pay(1).
const { ethers } = require("ethers");
const fs = require("fs");

const RPC = "https://arc-testnet.rpc.thirdweb.com";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const ID = 1;
const FUND = 2_000_000n; // 2 USDC (covers the 1 USDC payment + buffer)

const VAULT_ABI = [
  "function fund(uint256) external",
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
];
const ERC20_ABI = ["function approve(address,uint256) returns (bool)"];
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, n = 10) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      const m = String(e.message);
      if (m.includes("request limit") || m.includes("429") || m.includes("timeout")) {
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
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
  console.log(`owner: ${wallet.address}`);

  // ensure approval
  const ap = await withRetry(() => usdc.approve(VAULT, ethers.MaxUint256));
  await withRetry(() => ap.wait());
  console.log("approved vault to spend USDC");

  // fund vault
  const ftx = await withRetry(() => vault.fund(FUND));
  const frc = await withRetry(() => ftx.wait());
  console.log(`funded vault with ${Number(FUND)/1e6} USDC, tx ${frc.hash}`);

  // pay the due sub
  const s = await withRetry(() => vault.subs(ID));
  if (!s[6]) { console.log("sub not active — abort"); return; }
  console.log(`pay(${ID}) due=${new Date(Number(s[5])*1000).toISOString()} amt=${Number(s[1])/1e6} USDC`);
  const ptx = await withRetry(() => vault.pay(ID));
  const prc = await withRetry(() => ptx.wait());
  console.log(`PAID. tx: ${prc.hash}`);
  console.log(`ArcScan: https://testnet.arcscan.app/tx/${prc.hash}`);
}
main().catch((e) => { console.error(String(e).split("\n").slice(0,6).join("\n")); process.exit(1); });
