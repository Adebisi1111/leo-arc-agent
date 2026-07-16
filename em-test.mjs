import { initiateSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";
import { dcw } from "./circle-client.mjs";
// reuse dcw's already-initialized client shape by extracting its config is hard;
// instead build SCP client with same creds via env (circle-client exposes K,S pattern)
const client = initiateSmartContractPlatformClient({
  apiKey: proces...Y, entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});
try {
  const r = await client.createEventMonitor({
    blockchain: "ARC-TESTNET",
    contractAddress: "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F",
    eventSignature: "Paid(uint256,address,uint256,uint256)",
    idempotencyKey: (await import("crypto")).randomUUID(),
  });
  console.log("OK", JSON.stringify(r.data));
} catch (e) {
  console.log("STATUS:", e.status);
  console.log("BODY:", JSON.stringify(e.body || e.response?.data || e.message));
}
