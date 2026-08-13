import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
const c = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY, entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});
const WS = process.env.CIRCLE_WALLET_SET_ID;
// create a fresh wallet first
const cr = await c.createWallets({ walletSetId: WS, blockchains: ["ARC-TESTNET"], count: 1 });
const w = cr?.data?.wallets?.[0];
console.log("wallet:", w?.address, w?.id);
// try SDK faucet with walletId
try {
  const r = await c.requestTestnetTokens({ walletId: w.id, blockchain: "ARC-TESTNET", tokenId: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8" });
  console.log("SDK faucet OK:", JSON.stringify(r?.data).slice(0,200));
} catch (e) {
  console.log("SDK faucet ERR:", e?.code, e?.message?.slice(0,120), e?.response?.data?.message?.slice(0,120)||"");
}
// try raw with walletId
const https = require("https");
function api(m,p,b){return new Promise((res,rej)=>{const d=b?JSON.stringify(b):null;const rq=https.request({hostname:"api.circle.com",path:p,method:m,headers:{Authorization:"Bearer "+process.env.CIRCLE_API_KEY,"Content-Type":"application/json",...(d?{"Content-Length":Buffer.byteLength(d)}:{})}},r=>{let x="";r.on("data",c=>x+=c);r.on("end",()=>{try{res({s:r.statusCode,j:JSON.parse(x)})}catch{res({s:r.statusCode,j:{}})}})});rq.on("error",rej);if(d)rq.write(d);rq.end();});}
const r2 = await api("POST","/v1/faucet/drips",{walletId:w.id,blockchain:"ARC-TESTNET",tokenId:"15dc2b5d-0994-58b0-bf8c-3a0501148ee8"});
console.log("raw walletId faucet:", r2.s, JSON.stringify(r2.j).slice(0,160));
