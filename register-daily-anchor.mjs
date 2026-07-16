// register-daily-anchor.mjs — adds a guaranteed daily subscription so Leo always
// has >=1 due sub every calendar day (satisfies ">=1 tx/day"). Pays via Circle (no Arc throttle).
import { dcw } from "./circle-client.mjs";

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const WALLET_ID = process.env["CIRCLE_WALLET_ID"];
const ts = () => new Date().toISOString();

// Daily "Leo Keep-Alive" sub: 1 USDC, every 86400s (1 day), infinite cycles (0 = unlimited)
const DAY = 86400;
const anchor = {
  name: "Daily Keep-Alive",
  payee: "0x7010c7e4F6c8B6b9d6f3F3e7E6b1C0d3A2b9E8c1",
  amount: 1_000_000,
  interval: DAY,
  cycles: 0,
};

try {
  const r = await dcw.createContractExecutionTransaction({
    walletId: WALLET_ID, contractAddress: VAULT,
    abiFunctionSignature: "subscribe(address,uint256,uint256,uint256)",
    abiParameters: [anchor.payee, String(anchor.amount), String(anchor.interval), String(anchor.cycles)],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  console.log(`[${ts()}] registered ${anchor.name} (1-day, infinite) -> ${r.data.id} ${r.data.state}`);
} catch (e) {
  console.log(`[${ts()}] ERR:`, e.response ? JSON.stringify(e.response.data) : e.message);
}
