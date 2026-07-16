import { dcw } from "./circle-client.mjs";
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const USDC="0x3600000000000000000000000000000000000000";
const r=await dcw.createContractExecutionTransaction({walletId:process.env.CIRCLE_WALLET_ID,contractAddress:USDC,abiFunctionSignature:"transfer(address,uint256)",abiParameters:[VAULT,"2000000"],fee:{type:"level",config:{feeLevel:"MEDIUM"}}});
console.log("fund tx id:",r.data.id,"state:",r.data.state);
