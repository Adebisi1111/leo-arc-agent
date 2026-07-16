import { ethers } from "ethers";
import fs from "fs";
const p=new ethers.JsonRpcProvider("https://rpc.testnet.arc.network",5042002,{staticNetwork:true});
const USDC="0x3600000000000000000000000000000000000000";
const TO=process.env["CIRCLE_WALLET_ADDRESS"];
const pk=fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const w=new ethers.Wallet(pk,p);
const usdc=new ethers.Contract(USDC,["function transfer(address,uint256) returns(bool)"],w);
const isTh=m=>/-32011|request limit|429|timeout|SERVER_ERROR/i.test(String(m));
for(let i=0;i<60;i++){
  try{ const tx=await usdc.transfer(TO, 10_000_000n); const r=await tx.wait(); console.log("OK transfer:",r.hash); process.exit(0); }
  catch(e){ if(isTh(e.message)){ console.log("throttled "+(i+1)+", wait 45s"); await new Promise(r=>setTimeout(r,45000)); } else { console.log("ERR",e.message); process.exit(1);} }
}
process.exit(1);
