// setup-circle-agent.mjs — (1) setAgent(circleWallet) on vault, (2) send 3 USDC
// to the Circle wallet for gas. One-time. Patient retry on Arc -32011.
import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const USDC = "0x3600000000000000000000000000000000000000";
const CIRCLE_WALLET = process.env.CIRCLE_WALLET_ADDRESS;
const pk = fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const ts = () => new Date().toISOString();
const isThrottle = (m) => /-32011|request limit|429|timeout|SERVER_ERROR/i.test(String(m));

const vault = new ethers.Contract(VAULT, ["function setAgent(address) external","function agent() view returns(address)"], w);
const usdc = new ethers.Contract(USDC, ["function transfer(address,uint256) returns(bool)","function balanceOf(address) view returns(uint256)"], w);

async function send(fn, label){
  for(let i=0;i<80;i++){
    try{ const tx=await fn(); const r=await tx.wait(); console.log(`[${ts()}] ${label} OK ${r.hash}`); return true; }
    catch(e){ if(isThrottle(e.message)){ console.log(`[${ts()}] ${label} throttled ${i+1}, wait 45s`); await new Promise(r=>setTimeout(r,45000)); continue; } throw e; }
  }
  return false;
}

async function main(){
  console.log("Circle wallet:", CIRCLE_WALLET);
  const cur = await vault.agent();
  if (cur.toLowerCase() !== CIRCLE_WALLET.toLowerCase()){
    await send(()=>vault.setAgent(CIRCLE_WALLET), "setAgent");
  } else console.log("agent already set to Circle wallet");
  const bal = await usdc.balanceOf(CIRCLE_WALLET);
  if (bal < 3_000_000n){
    await send(()=>usdc.transfer(CIRCLE_WALLET, 3_000_000n), "fund Circle wallet 3 USDC gas");
  } else console.log("Circle wallet already funded:", bal.toString());
  console.log("agent now:", await vault.agent());
}
main().catch(e=>{ console.error("ERR", e.message); process.exit(1); });
