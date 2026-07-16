import { ethers } from "ethers"; import fs from "fs";
const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network",5042002,{staticNetwork:true});
const pk = fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const w = new ethers.Wallet(pk, p);
const usdc = new ethers.Contract("0x3600000000000000000000000000000000000000",["function approve(address,uint256) returns(bool)","function allowance(address,address) view returns(uint256)"], w);
const vault = new ethers.Contract("0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F",["function fund(uint256) external"], w);
const AMT = 10_000_000n; // 10 USDC (6 decimals)
async function send(fn, label){ for(let i=0;i<40;i++){ try{ const tx=await fn(); const r=await tx.wait(); console.log(label,"OK",r.hash); return; }catch(e){ if(/-32011|request limit|429|timeout|SERVER_ERROR/i.test(String(e.message))){ console.log(label,"throttled, retry in 45s"); await new Promise(r=>setTimeout(r,45000)); continue;} throw e; } } throw new Error(label+" exhausted"); }
const allow = await usdc.allowance(w.address, "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F");
console.log("allowance:", allow.toString());
if (allow < AMT) await send(()=>usdc.approve("0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F", AMT*100n), "approve");
await send(()=>vault.fund(AMT), "fund");
