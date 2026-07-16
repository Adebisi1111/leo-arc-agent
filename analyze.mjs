import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const v=new ethers.Contract(VAULT,["function nextId() view returns (uint256)","function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)"],provider);
const nextId = Number(await v.nextId());
const now = Math.floor(Date.now()/1000);
console.log("nextId:", nextId, "| now(unix):", now, "\n");
console.log("id | interval(s) | amount | paid | on-chain nextDue | firstSeen(now) math");
for (let id=0; id<nextId; id++){
  const s = await v.subs(id);
  const [, amt, intv, , paid, nextDue, active] = s;
  // agent's logic: firstSeen[0] = first run time; we don't know exact, but assume t0
  console.log(`#${id} | intv ${intv}s | ${Number(amt)/1e6} USDC | paid=${paid} | nextDue=${Number(nextDue)} | active=${active}`);
}
