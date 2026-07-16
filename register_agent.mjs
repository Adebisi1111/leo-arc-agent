// ERC-8004 agent registration on Arc Testnet (rate-limit safe)
import { createPublicClient, createWalletClient, http, getContract, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";

const arcTestnet = {
  id: 5042002, name: "Arc Testnet", network: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
};
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const METADATA_URI = "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";

const ownerKey = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const validatorKey = process.env.VALIDATOR_PRIVATE_KEY;
if (!validatorKey) { console.error("Set VALIDATOR_PRIVATE_KEY first"); process.exit(1); }

const ownerAccount = privateKeyToAccount(ownerKey);
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const ownerWalletClient = createWalletClient({ account: ownerAccount, chain: arcTestnet, transport: http() });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 6) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (String(e.message).includes("request limit") || String(e.message).includes("429")) { await sleep(2000 * (i + 1)); continue; } throw e; }
  }
  throw new Error("rate limit exhausted");
}

const identityContract = getContract({
  address: IDENTITY_REGISTRY,
  abi: [
    { name: "register", type: "function", stateMutability: "nonpayable", inputs: [{ name: "metadataURI", type: "string" }], outputs: [] },
    { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
  ],
  client: { public: publicClient, wallet: ownerWalletClient },
});

async function main() {
  console.log(`Registering AutoSub agent identity from owner ${ownerAccount.address}...`);
  const tx = await retry(() => identityContract.write.register([METADATA_URI], { account: ownerAccount }));
  console.log(`tx sent: ${tx}`);
  await retry(() => publicClient.waitForTransactionReceipt({ hash: tx }));
  console.log(`Registered: https://testnet.arcscan.app/tx/${tx}`);

  const latest = await retry(() => publicClient.getBlockNumber());
  const fromBlock = latest > 10000n ? latest - 10000n : 0n;
  const logs = await retry(() => publicClient.getLogs({
    address: IDENTITY_REGISTRY,
    event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
    args: { to: ownerAccount.address }, fromBlock, toBlock: latest,
  }));
  if (!logs.length) throw new Error("No Transfer event — registration may have failed");
  const agentId = logs[logs.length - 1].args.tokenId.toString();
  const owner = await retry(() => identityContract.read.ownerOf([BigInt(agentId)]));
  const uri = await retry(() => identityContract.read.tokenURI([BigInt(agentId)]));
  console.log(`AGENT_ID=${agentId}`);
  console.log(`OWNER=${owner}`);
  console.log(`METADATA=${uri}`);
  fs.writeFileSync("agent_identity.json", JSON.stringify({ agentId, owner, metadata: uri, tx }, null, 2));
  console.log("Saved agent_identity.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
