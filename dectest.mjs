import { ethers } from "ethers";
// from the cast raw log: data field
const data = "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000001";
// attempt common layouts:
// A) (uint256 id, address payee, uint256 amount, uint256 cycle)
// B) (uint256 id, address payee, uint256 cycle, uint256 amount)
// C) (address payee, uint256 id, uint256 amount, uint256 cycle)
const ifaceA = new ethers.Interface(["event SubscriptionSettled(uint256 id, address payee, uint256 amount, uint256 cycle)"]);
const ifaceB = new ethers.Interface(["event SubscriptionSettled(uint256 id, address payee, uint256 cycle, uint256 amount)"]);
const ifaceC = new ethers.Interface(["event SubscriptionSettled(address payee, uint256 id, uint256 amount, uint256 cycle)"]);
// topics[0] is the event topic; we need it. Use the known on-chain topic:
const topic = "0x59e5c638e8e7ab669e805847b18203cf00e4ab4d0688c3da8e486aba4cc4fed2";
for (const [name, iface] of [["A",ifaceA],["B",ifaceB],["C",ifaceC]]) {
  try { const d = iface.decodeEventLog("SubscriptionSettled", data, [topic]); console.log(name, JSON.stringify([...d])); }
  catch(e){ console.log(name, "fail:", e.message.slice(0,60)); }
}
// also brute-force: try several signatures to match topic
const sigs = [
  "SubscriptionSettled(uint256,address,uint256,uint256)",
  "SubscriptionSettled(uint256,address,uint256,uint256)",
  "SubscriptionSettled(address,uint256,uint256,uint256)",
  "SubscriptionSettled(uint256,uint256,address,uint256)",
  "Settled(uint256,address,uint256,uint256)",
  "PaymentSettled(uint256,address,uint256,uint256)",
];
for (const s of sigs) { const t = ethers.keccak256(ethers.toUtf8Bytes(s)); if (t===topic) console.log("MATCH:", s); }
process.exit(0);
