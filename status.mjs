import { ethers } from "ethers"; import fs from "fs";
const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network",5042002,{staticNetwork:true});
const v = new ethers.Contract("0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F",["function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)","function nextId() view returns(uint256)"],p);
const nextId = Number(await v.nextId());
const labels=["Corner Coffee","Mike's Diner","Market Grocery","Corner Coffee","Mike's Diner","Market Grocery"];
const now=Math.floor(Date.now()/1000);
for(let i=0;i<nextId;i++){const s=await v.subs(i);const [payee,amt,intv,cycles,paid,nextDue,active]=s;
console.log(`#${i} ${labels[i]||""}: active=${active} paid=${paid}/${cycles} nextDue=${Number(nextDue)} (${Number(nextDue)>now?"FUTURE":"OVERDUE"}) intv=${intv}s`);}
