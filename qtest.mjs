import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const v=new ethers.Contract(VAULT,["event SubscriptionSettled(uint256 id, address payee, uint256 amount, uint256 cycle)"],provider);
const head = await provider.getBlockNumber();
console.log("head:", head);
const from = 52015005, to = Math.min(head-1, 52015010);
console.log("query", from, "->", to);
try {
  const logs = await v.queryFilter(v.filters.SubscriptionSettled(), from, to);
  console.log("found:", logs.length);
  for (const l of logs) console.log("  id", Number(l.args.id), "payee", l.args.payee, "tx", l.transactionHash);
} catch(e){ console.log("ERR:", e.message); }
process.exit(0);
