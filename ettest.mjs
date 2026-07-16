import { ethers } from "ethers";
const RPC = "https://rpc.testnet.arc.network";
const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const t = setTimeout(() => { console.log("TIMEOUT: hung >15s"); process.exit(2); }, 15000);
try {
  const b = await p.getBlockNumber();
  console.log("block:", b);
  const code = await p.getCode("0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F");
  console.log("vault code len:", code.length);
} catch (e) {
  console.log("ERR:", e.message);
} finally { clearTimeout(t); process.exit(0); }
