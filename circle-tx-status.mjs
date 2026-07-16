import { dcw } from "./circle-client.mjs";
const r=await dcw.getTransaction({id:process.argv[2]});
const t=r.data.transaction;
console.log(JSON.stringify({id:t.id,state:t.state,txHash:t.txHash,errorReason:t.errorReason},null,2));
