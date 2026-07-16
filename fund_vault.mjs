// Step A only: fund the vault (minimal calls, long backoff)
import { ethers } from "ethers";
import fs from "fs";
const RPC = "https://rpc.testnet.arc.network", CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 15) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (/request limit|429|SERVER_ERROR/i.test(String(e.message))) { await sleep(5000 * (i + 1)); continue; } throw e; }
  }
  throw new Error("rate limit exhausted");
}
async function main() {
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, ["function fund(uint256) external","function balance() view returns (uint256)"], wallet);
  const usdc = new ethers.Contract(USDC, ["function approve(address,uint256) returns (bool)","function balanceOf(address) view returns (uint256)"], wallet);
  const bal = Number(await retry(() => usdc.balanceOf(VAULT)));
  console.log("vault USDC now:", bal / 1e6);
  if (bal < 5_000_000) {
    const ap = await retry(() => usdc.approve(VAULT, ethers.MaxUint256)); await retry(() => ap.wait());
    console.log("approved");
    await sleep(3000);
    const f = await retry(() => vault.fund(16_000_000)); await retry(() => f.wait());
    console.log("funded tx:", f.hash);
  }
  console.log("vault USDC after:", Number(await retry(() => usdc.balanceOf(VAULT))) / 1e6);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
