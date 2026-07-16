// One-shot: settle id 0,1,2 via Multicall3From, print full error if revert
import { ethers } from "ethers";
import fs from "fs";
const RPC = "https://rpc.testnet.arc.network", CHAIN_ID = 5042002;
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const MULTI = "0x522fAf9A91c41c443c66765030741e4AaCe147D0";
const VAULT_ABI = ["function pay(uint256) external", "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)", "function nextId() view returns (uint256)"];
const MULTI_ABI = ["function aggregate3(tuple(address target,bool allowFailure,bytes callData)[]) external"];
const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 25) { for (let i=0;i<n;i++){ try { return await fn(); } catch(e){ if(/request limit|429|SERVER_ERROR/i.test(String(e.message))){ await sleep(7000*(i+1)); continue; } throw e; } } throw new Error("rate limit exhausted"); }
(async () => {
  const pk = fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const multi = new ethers.Contract(MULTI, MULTI_ABI, wallet);
  const nextId = Number(await retry(() => vault.nextId()));
  const calls = [];
  for (let id=0; id<nextId; id++){ const s = await retry(()=>vault.subs(id)); if(!s[6]) continue; calls.push({target:VAULT,allowFailure:false,callData:vault.interface.encodeFunctionData("pay",[id])}); }
  console.log("calls:", calls.length);
  try {
    const tx = await retry(() => multi.aggregate3(calls));
    console.log("submitted", tx.hash);
    const rcpt = await retry(() => tx.wait());
    console.log("SETTLED status", rcpt.status, "tx", rcpt.hash);
  } catch (e) {
    console.error("REVERT:", e.shortMessage || e.message);
    if (e.data) console.error("data:", e.data);
  }
})();
