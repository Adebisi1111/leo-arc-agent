// create-circle-wallet.mjs — creates a developer-controlled wallet set + wallet
// on ARC-TESTNET, prints the wallet id + address, appends ids to .env.
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { appendFileSync } from "node:fs";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// 1) create a wallet set
const ws = await client.createWalletSet({ name: "Leo AutoSub WalletSet" });
const walletSetId = ws.data.walletSet.id;
console.log("walletSetId:", walletSetId);

// 2) create a wallet in that set on ARC-TESTNET
const w = await client.createWallets({
  walletSetId,
  blockchains: ["ARC-TESTNET"],
  count: 1,
  accountType: "EOA",
});
const wallet = w.data.wallets[0];
console.log("walletId:", wallet.id);
console.log("address:", wallet.address);

appendFileSync(".env", `\nCIRCLE_WALLET_SET_ID=${walletSetId}\nCIRCLE_WALLET_ID=${wallet.id}\nCIRCLE_WALLET_ADDRESS=${wallet.address}\n`);
console.log("Saved CIRCLE_WALLET_* to .env");
