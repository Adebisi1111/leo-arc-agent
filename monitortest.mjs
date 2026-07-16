import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const abi=["event SubscriptionSettled(uint256 id, address payee, uint256 amount, uint256 cycle)"];
const v=new ethers.Contract(VAULT,abi,provider);
const t=setTimeout(()=>{console.log("TIMEOUT");process.exit(2);},20000);
const from = 52014910;  // ~0x319ad3f - 1
const to = 52014911;
try {
  const logs = await v.queryFilter(v.filters.SubscriptionSettled(), from, to);
  console.log("logs found:", logs.length);
  for (const l of logs) console.log("  id", Number(l.args.id), "payee", l.args.payee, "tx", l.transactionHash);
} catch(e){ console.log("ERR:", e.message); } finally { clearTimeout(t); process.exit(0); }
