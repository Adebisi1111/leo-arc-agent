import { dcw } from "./circle-client.mjs";
import { ethers } from "ethers";
import fs from "fs";
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const USDC="0x3600000000000000000000000000000000000000";
const WHALE=process.env["CIRCLE_WALLET_ADDRESS"];
const p=new ethers.JsonRpcProvider("https://rpc.testnet.arc.network",5042002,{staticNetwork:true});
const usdc=new ethers.Contract(USDC,["function balanceOf(address) view returns(uint256)"],p);
const log=(...a)=>console.log(new Date().toISOString(),...a);
log("WHALE",WHALE);
try {
  log("reading Circle wallet USDC...");
  const bal=await Promise.race([usdc.balanceOf(WHALE), new Promise((_,r)=>setTimeout(()=>r(new Error("READ TIMEOUT")),15000))]);
  log("Circle wallet USDC:", Number(bal)/1e6);
} catch(e){ log("READ ERR:", e.message); }
try {
  log("calling Circle createContractExecutionTransaction (fund vault 5 USDC)...");
  const r=await Promise.race([
    dcw.createContractExecutionTransaction({walletId:process.env["CIRCLE_WALLET_ID"],contractAddress:USDC,abiFunctionSignature:"transfer(address,uint256)",abiParameters:[VAULT,"5000000"],fee:{type:"level",config:{feeLevel:"MEDIUM"}}}),
    new Promise((_,r)=>setTimeout(()=>r(new Error("CIRCLE TIMEOUT 30s")),30000))
  ]);
  log("Circle resp:", JSON.stringify(r.data));
} catch(e){ log("CIRCLE ERR:", e.message); }
process.exit(0);
