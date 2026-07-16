import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true });
const VAULT="0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
// keccak of event signature
const sig = "SubscriptionSettled(uint256,address,uint256,uint256)";
const topic = ethers.keccak256(ethers.toUtf8Bytes(sig));
console.log("computed topic:", topic);
const head = await provider.getBlockNumber();
console.log("head:", head, "target block 52015007");
// raw getLogs with explicit topic
const res = await provider.getLogs({ address: VAULT, topics: [topic], fromBlock: 52015005, toBlock: 52015010 });
console.log("raw getLogs found:", res.length);
for (const l of res) console.log("  tx", l.transactionHash, "block", Number(l.blockNumber));
process.exit(0);
