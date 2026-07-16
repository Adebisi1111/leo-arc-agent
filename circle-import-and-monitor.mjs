import { scp } from "./circle-client.mjs";
import crypto from "crypto";
import fs from "fs";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const abi = JSON.parse(fs.readFileSync("vault-abi.json","utf8"));
try {
  const imp = await scp.importContract({
    idempotencyKey: crypto.randomUUID(),
    name: "SubscriptionVault",
    description: "Leo AutoSub vault",
    address: VAULT,
    blockchain: "ARC-TESTNET",
    abiJson: JSON.stringify(abi),
  });
  console.log("IMPORT:", JSON.stringify(imp.data));
} catch (e) {
  console.log("IMPORT ERR status", e.status, ":", JSON.stringify(e.body || e.message));
}
try {
  const mon = await scp.createEventMonitor({
    blockchain: "ARC-TESTNET",
    contractAddress: VAULT,
    eventSignature: "Paid(uint256,address,uint256,uint256)",
    idempotencyKey: crypto.randomUUID(),
  });
  console.log("MONITOR:", JSON.stringify(mon.data));
  console.log(">>> Set Circle Console Webhook URL: https://stingray-science-liquid.ngrok-free.dev");
} catch (e) {
  console.log("MONITOR ERR status", e.status, ":", JSON.stringify(e.body || e.message));
}
