import { scp } from "./circle-client.mjs";
import crypto from "crypto";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
try {
  const r = await scp.createEventMonitor({
    blockchain: "ARC-TESTNET",
    contractAddress: VAULT,
    eventSignature: "Paid(uint256,address,uint256,uint256)",
    idempotencyKey: crypto.randomUUID(),
  });
  console.log("Event Monitor created:", JSON.stringify(r.data));
  console.log("Set Circle Console -> Webhooks URL to: https://stingray-science-liquid.ngrok-free.dev");
} catch (e) {
  console.log("STATUS:", e.status, "URL:", e.url);
  console.log("BODY:", JSON.stringify(e.body || e.response?.data || e.message));
}
