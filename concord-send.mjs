import { dcw } from "./circle-client.mjs";
const USDC = "0x3600000000000000000000000000000000000000";
const to = process.argv[2];
const amountUSDC = process.argv[3];
const amountRaw = Math.round(Number(amountUSDC) * 1e6).toString();
console.log(`Sending ${amountUSDC} USDC (${amountRaw} raw) -> ${to}`);
const resp = await dcw.createContractExecutionTransaction({
  walletId: process.env.CIRCLE_WALLET_ID,
  contractAddress: USDC,
  abiFunctionSignature: "transfer(address,uint256)",
  abiParameters: [to, amountRaw],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});
console.log("OK id=" + resp.data.id + " state=" + resp.data.state);
console.log("FULL " + JSON.stringify(resp.data));
