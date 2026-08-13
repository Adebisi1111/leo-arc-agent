// Concord — Unified Balance Settlement Agent (v2)
// Primary: Direct vault.fund() + vault.pay() from owner wallet
// Enhanced: Circle Unified Balance Kit for cross-chain USDC sourcing
import { ethers } from "ethers";
import fs from "fs";

// Load config from .env
const envContent = fs.readFileSync(".env", "utf8");
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match ? match[1].trim() : process.env[key];
};

const CIRCLE_API_KEY = getEnv("CIRCLE_API_KEY");
const CIRCLE_ENTITY_SECRET = getEnv("CIRCLE_ENTITY_SECRET");
const CIRCLE_WALLET_ID = getEnv("CIRCLE_WALLET_ID");

// Arc testnet config
const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

const VAULT_ABI = [
  "function fund(uint256) external",
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, n = 12) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      const m = String(e.message);
      if (m.includes("request limit") || m.includes("429") || m.includes("timeout") || m.includes("throttl")) {
        await sleep(2500 * (i + 1)); continue;
      }
      throw e;
    }
  }
  throw new Error("RPC retries exhausted");
}

const BALANCE_BUFFER = 3_000_000n; // keep >= 3 USDC in vault

async function checkUnifiedBalance() {
  // Try to check Circle unified balance (non-critical)
  try {
    const { initiateDeveloperControlledWalletsClient } = await import("@circle-fin/developer-controlled-wallets");
    const dcw = initiateDeveloperControlledWalletsClient({
      apiKey: CIRCLE_API_KEY,
      entitySecret: CIRCLE_ENTITY_SECRET,
    });
    const bal = await dcw.getWalletTokenBalance({
      id: CIRCLE_WALLET_ID,
      tokenAddress: USDC,
    });
    if (bal.data?.tokenBalances?.length > 0) {
      const total = bal.data.tokenBalances.reduce((sum, b) => sum + BigInt(b.amount || "0"), 0n);
      return total;
    }
  } catch (e) {
    // Non-critical — unified balance is optional
  }
  return 0n;
}

async function main() {
  // Load wallet private key
  const pk = fs.readFileSync("wallet.json", "utf8").match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
  const wallet = new ethers.Wallet(pk, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

  console.log(`[${new Date().toISOString()}] Concord unified settle waking — owner ${wallet.address}`);

  // Check unified balance (optional enhancement)
  const unifiedBal = await checkUnifiedBalance();
  if (unifiedBal > 0n) {
    console.log(`Circle unified balance: ${Number(unifiedBal) / 1e6} USDC (available for cross-chain funding)`);
  }

  // Ensure vault is approved to pull USDC
  const allowance = BigInt(await withRetry(() => usdc.allowance(wallet.address, VAULT)));
  if (allowance < ethers.MaxUint256 / 2n) {
    const ap = await withRetry(() => usdc.approve(VAULT, ethers.MaxUint256));
    await withRetry(() => ap.wait());
    console.log("Approved vault to spend USDC");
  }

  const nextId = Number(await withRetry(() => vault.nextId()));
  const now = Math.floor(Date.now() / 1000);

  // Gather due subscriptions
  const due = [];
  for (let id = 0; id < nextId; id++) {
    const s = await withRetry(() => vault.subs(id));
    if (s[6] && Number(s[5]) <= now) {
      due.push({ id, payee: s[0], amount: BigInt(s[1]) });
    }
  }

  if (due.length === 0) {
    console.log("Nothing due. Agent idle.");
    return;
  }

  const totalDue = due.reduce((a, d) => a + d.amount, 0n);
  let vaultBal = BigInt(await withRetry(() => usdc.balanceOf(VAULT)));
  console.log(`Due: ${due.length} subs, total ${Number(totalDue) / 1e6} USDC. Vault has ${Number(vaultBal) / 1e6} USDC.`);

  // Top up vault if needed
  if (vaultBal < totalDue + BALANCE_BUFFER) {
    const need = totalDue + BALANCE_BUFFER - vaultBal;
    console.log(`Vault needs +${Number(need) / 1e6} USDC. Funding from owner wallet...`);
    
    // Check owner balance
    const ownerBal = BigInt(await withRetry(() => usdc.balanceOf(wallet.address)));
    if (ownerBal < need) {
      console.log(`Owner has ${Number(ownerBal) / 1e6} USDC — insufficient to fund ${Number(need) / 1e6} USDC`);
      if (unifiedBal >= need) {
        console.log("→ Unified balance has enough! Use Circle SDK to bridge funds.");
        // TODO: Implement kit.unifiedBalance.spend() when Circle Gateway is set up
      }
      return;
    }
    
    const ftx = await withRetry(() => vault.fund(need));
    const frc = await withRetry(() => ftx.wait());
    vaultBal = BigInt(await withRetry(() => usdc.balanceOf(VAULT)));
    console.log(`Funded vault +${Number(need) / 1e6} USDC (tx ${frc.hash.slice(0, 12)}…). Vault now ${Number(vaultBal) / 1e6} USDC.`);
  }

  // Pay every due subscription
  let paid = 0;
  for (const d of due) {
    try {
      const tx = await withRetry(() => vault.pay(d.id));
      const rcpt = await withRetry(() => tx.wait());
      paid++;
      console.log(`  paid #${d.id} ${Number(d.amount) / 1e6} USDC -> ${d.payee.slice(0, 10)}… (tx ${rcpt.hash.slice(0, 12)}…)`);
      console.log(`NOTIFY|#${d.id}|${d.payee}|${(Number(d.amount) / 1e6).toFixed(2)} USDC|${rcpt.hash}`);
      await sleep(1200);
    } catch (e) {
      console.error(`  FAILED #${d.id}: ${String(e.message).split("\n")[0]}`);
    }
  }
  console.log(`[${new Date().toISOString()}] Settled ${paid}/${due.length} due subscriptions. Done.`);
}

main().catch((e) => { console.error(String(e).split("\n").slice(0, 8).join("\n")); process.exit(1); });
