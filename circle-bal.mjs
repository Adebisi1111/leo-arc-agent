import { dcw } from "./circle-client.mjs";
try {
  const r = await dcw.getWalletTokenBalance({ id: process.env["CIRCLE_WALLET_ID"], tokenId: "USDC" });
  console.log("OK:", JSON.stringify(r.data));
} catch(e){ console.log("ERR", e.status, JSON.stringify(e.body||e.message)); }
