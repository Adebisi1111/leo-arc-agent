import { dcw } from "./circle-client.mjs";
const to = process.argv[2];
const amountUSDC = process.argv[3];
console.log(`Sending ${amountUSDC} USDC -> ${to} on ARC-TESTNET`);
const resp = await dcw.createTransaction({
  walletId: process.env.CIRCLE_WALLET_ID,
  tokenId: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
  destinationAddress: to,
  amounts: [String(amountUSDC)],
  blockchain: "ARC-TESTNET",
  fee: { type: "level", config: { feeLevel: "LOW" } },
});
const id = resp?.data?.id;
console.log("OK id=" + id + " state=" + (resp?.data?.state || "n/a"));
