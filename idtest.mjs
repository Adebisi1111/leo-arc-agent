import { ethers } from "ethers"; import fs from "fs";
const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const pk = fs.readFileSync("wallet.json","utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
console.log("pk found:", pk ? "yes" : "no", pk?.slice(0,10));
const w = new ethers.Wallet(pk, p);
const v = new ethers.Contract(VAULT, ["function nextId() view returns (uint256)"], w);
const t=setTimeout(()=>{console.log("TIMEOUT nextId");process.exit(2);},15000);
try { const n = await v.nextId(); console.log("nextId:", Number(n)); }
catch(e){ console.log("ERR:", e.message); } finally { clearTimeout(t); process.exit(0); }
