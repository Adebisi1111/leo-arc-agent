// circle-pay.mjs — Circle-native Leo executor.
// Uses developer-controlled-wallets createContractExecutionTransaction to call
// vault.pay(id) FROM the Circle wallet (agent). Circle submits the tx to Arc,
// bypassing our IP's -32011 throttle. Reads due subs via ethers (reads are fine).
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { ethers } from "ethers";

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const RPC = "https://rpc.testnet.arc.network";
const WALLET_ID = process.env.CIRCLE_WALLET_ID;

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const vault = new ethers.Contract(VAULT, [
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns(uint256)",
], p);

const ts = () => new Date().toISOString();

async function main() {
  const nextId = Number(await vault.nextId());
  const now = Math.floor(Date.now() / 1000);
  let target = -1;
  for (let id = 0; id < nextId; id++) {
    const s = await vault.subs(id);
    const [, , , cycles, paid, nextDue, active] = s;
    if (!active) continue;
    if (cycles !== 0n && paid >= cycles) continue;
    if (now < Number(nextDue)) continue;
    target = id; break;
  }
  if (target < 0) { console.log(`[${ts()}] nothing due`); return; }

  console.log(`[${ts()}] executing vault.pay(${target}) via Circle SCP...`);
  const resp = await client.createContractExecutionTransaction({
    walletId: WALLET_ID,
    contractAddress: VAULT,
    abiFunctionSignature: "pay(uint256)",
    abiParameters: [String(target)],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  console.log(`[${ts()}] Circle tx id: ${resp.data.id} state: ${resp.data.state}`);
  console.log("Full:", JSON.stringify(resp.data));
}
main().catch(e => { console.error("ERR", e.response ? JSON.stringify(e.response.data) : e.message); process.exit(1); });
