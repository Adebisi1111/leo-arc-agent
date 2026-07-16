import { ethers } from "ethers"; import fs from "fs";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const pk = fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const wallet = new ethers.Wallet(pk, provider);
const v = new ethers.Contract(VAULT, ["function pay(uint256) external","function nextId() view returns (uint256)"], wallet);
const t=setTimeout(()=>{console.log("TIMEOUT 30s");process.exit(2);},30000);
try {
  console.log("sending pay(0)...");
  const tx = await v.pay(0);
  console.log("tx hash:", tx.hash);
  const r = await tx.wait();
  console.log("confirmed block:", r.blockNumber);
} catch(e){ console.log("ERR:", e.message); } finally { clearTimeout(t); process.exit(0); }
