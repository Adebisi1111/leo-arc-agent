// ERC-8004 full flow — steps 6 (reputation) + 7 (validation) on Arc Testnet
// Raw-key Viem (no Circle Console needed). Per docs.arc.io register-your-first-ai-agent
import { createPublicClient, createWalletClient, http, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";
import fs from "fs";

const arcTestnet = {
  id: 5042002, name: "Arc Testnet", network: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
};

const IDENTITY_REGISTRY   = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const VALIDATION_REGISTRY = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272";

const ownerKey     = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const validatorKey = fs.readFileSync("validator_wallet.json", "utf8").match(/"private_key":\s*"(0x[0-9a-fA-F]+)"/)[1];
const agentId = 851166;

const ownerAccount = privateKeyToAccount(ownerKey);
const validatorAccount = privateKeyToAccount(validatorKey);
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const ownerClient = createWalletClient({ account: ownerAccount, chain: arcTestnet, transport: http() });
const validatorClient = createWalletClient({ account: validatorAccount, chain: arcTestnet, transport: http() });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 15) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (/request limit|429|SERVER_ERROR/i.test(String(e.message))) { await sleep(5000 * (i + 1)); continue; } throw e; }
  }
  throw new Error("rate limit exhausted");
}

async function send(client, addr, abi, fn, args) {
  const c = getContract({ address: addr, abi: [abi], client: { public: publicClient, wallet: client } });
  const tx = await retry(() => c.write[fn](args, { account: client.account }));
  console.log(`  tx ${tx}`);
  await retry(() => publicClient.waitForTransactionReceipt({ hash: tx }));
  console.log(`  confirmed: https://testnet.arcscan.app/tx/${tx}`);
  return tx;
}

async function main() {
  // ---- STEP 6: Record reputation (validator wallet) ----
  console.log("STEP 6: recording reputation via validator...");
  const tag = "subscription_settled";
  const feedbackHash = keccak256(toHex(tag));
  const repABI = { name: "giveFeedback", type: "function", stateMutability: "nonpayable",
    inputs: [{type:"uint256"},{type:"int128"},{type:"uint8"},{type:"string"},{type:"string"},{type:"string"},{type:"string"},{type:"bytes32"}],
    outputs: [] };
  await send(validatorClient, REPUTATION_REGISTRY, repABI, "giveFeedback",
    [BigInt(agentId), 95n, 0n, tag, "", "", "", feedbackHash]);

  // ---- STEP 7: validation request (owner) + response (validator) ----
  console.log("STEP 7: validation request + response...");
  const requestURI = "ipfs://bafkreiexamplevalidationrequest";
  const requestHash = keccak256(toHex(`kyc_verification_request_agent_${agentId}`));
  const reqABI = { name: "validationRequest", type: "function", stateMutability: "nonpayable",
    inputs: [{type:"address"},{type:"uint256"},{type:"string"},{type:"bytes32"}], outputs: [] };
  await send(ownerClient, VALIDATION_REGISTRY, reqABI, "validationRequest",
    [validatorAccount.address, BigInt(agentId), requestURI, requestHash]);

  const resABI = { name: "validationResponse", type: "function", stateMutability: "nonpayable",
    inputs: [{type:"bytes32"},{type:"uint8"},{type:"string"},{type:"bytes32"},{type:"string"}], outputs: [] };
  await send(validatorClient, VALIDATION_REGISTRY, resABI, "validationResponse",
    [requestHash, 100n, "", "0x" + "0".repeat(64), "agent_identity_confirmed"]);

  // ---- verify ----
  console.log("Verifying validation status...");
  const vABI = { name: "getValidationStatus", type: "function", stateMutability: "view",
    inputs: [{type:"bytes32"}], outputs: [{type:"address"},{type:"uint256"},{type:"uint8"},{type:"bytes32"},{type:"string"},{type:"uint256"}] };
  const status = await retry(() => getContract({ address: VALIDATION_REGISTRY, abi: [vABI], client: { public: publicClient } })
    .read.getValidationStatus([requestHash]));
  console.log("VALIDATION:", { validator: status[0], agentId: status[1].toString(), response: status[2], tag: status[4] });

  fs.writeFileSync("agent_full_identity.json", JSON.stringify({
    agentId, owner: ownerAccount.address, validator: validatorAccount.address,
    identity: IDENTITY_REGISTRY, reputation: REPUTATION_REGISTRY, validation: VALIDATION_REGISTRY,
    reputationTag: tag, validationTag: "agent_identity_confirmed"
  }, null, 2));
  console.log("Saved agent_full_identity.json — ERC-8004 flow complete.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
