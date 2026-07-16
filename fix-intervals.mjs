import { dcw } from "./circle-client.mjs";
import { ethers } from "ethers";
import fs from "fs";

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const WALLET_ID = process.env["CIRCLE_WALLET_ID"];
const RPC = "https://rpc.testnet.arc.network";
const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const vault = new ethers.Contract(VAULT, [
  "function subscribe(address,uint256,uint256,uint256)",
  "function cancel(uint256)",
  "function nextId() view returns(uint256)",
], p);
const ts = () => new Date().toISOString();

// 1) Register 3 realistic subs via Circle agent (no throttle)
const subs = [
  { name: "Coffee", payee: "0x7010c7e4F6c8B6b9d6f3F3e7E6b1C0d3A2b9E8c1", amount: 1_000_000, interval: 86400, cycles: 30 },
  { name: "Diner",  payee: "0x8a2b3c4D5e6F70819a2B3c4D5e6F708192a3B4c5", amount: 2_000_000, interval: 259200, cycles: 12 },
  { name: "Grocery",payee: "0x9f1e2d3C4b5A69788796a5B4c3D2e1F0a9b8C7d6", amount: 5_000_000, interval: 604800, cycles: 8 },
];
console.log(`[${ts()}] registering 3 realistic subscriptions via Circle...`);
for (const s of subs) {
  try {
    const r = await dcw.createContractExecutionTransaction({
      walletId: WALLET_ID, contractAddress: VAULT,
      abiFunctionSignature: "subscribe(address,uint256,uint256,uint256)",
      abiParameters: [s.payee, String(s.amount), String(s.interval), String(s.cycles)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    console.log(`[${ts()}] registered ${s.name} (${s.interval}s) -> ${r.data.id} ${r.data.state}`);
  } catch(e){ console.log(`[${ts()}] ERR ${s.name}:`, e.response ? JSON.stringify(e.response.data) : e.message); }
}

// 2) Cancel old 6 subs via owner wallet (Arc, patient retry)
console.log(`[${ts()}] cancelling old 6 subs via owner (patient)...`);
const pk = fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const ow = new ethers.Wallet(pk, p);
const vaultO = new ethers.Contract(VAULT, ["function cancel(uint256)"], ow);
const isTh = m => /-32011|request limit|429|timeout|SERVER_ERROR/i.test(String(m));
let nextId = 6;
try { nextId = Number(await vault.nextId()); } catch(e){}
for (let id=0; id<Math.min(nextId,6); id++){
  for (let i=0;i<40;i++){
    try { const tx = await vaultO.cancel(id); const rc = await tx.wait(); console.log(`[${ts()}] cancelled #${id}: ${rc.hash}`); break; }
    catch(e){ if(isTh(e.message)){ console.log(`[${ts()}] cancel #${id} throttled ${i+1}, wait 45s`); await new Promise(r=>setTimeout(r,45000)); } else { console.log(`[${ts()}] cancel #${id} ERR ${e.message}`); break; } }
  }
}
console.log(`[${ts()}] done. nextId=${nextId}`);
