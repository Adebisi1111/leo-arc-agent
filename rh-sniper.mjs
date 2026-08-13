// Robinhood Chain free-mint sniper
// Polls Blockscout for new ERC-721/1155 contracts, detects mintable, snipes from funded wallet.
import { createPublicClient, createWalletClient, http, parseAbi, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = 4663;
const EXPLORER = "https://robinhoodchain.blockscout.com/api/v2";
const PK = fs.readFileSync(".env.rh", "utf8").match(/RH_WALLET_PK=(0x[0-9a-f]+)/)[1];
const ADDR = fs.readFileSync(".env.rh", "utf8").match(/RH_WALLET_ADDRESS=(0x[0-9a-fA-F]+)/)[1];

const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ transport: http(RPC) });
const walletClient = createWalletClient({ account, transport: http(RPC) });

const SEEN = new Set();
const LOG = "rh-sniper.log";
const MAX_MINTS = 5; // mint this many per safe free-mint catch
function log(m) { const s = `[${new Date().toISOString()}] ${m}`; console.log(s); fs.appendFileSync(LOG, s + "\n"); }

// common free-mint ABI variants
const MINT_ABIS = [
  parseAbi(["function mint()"]),
  parseAbi(["function mint(uint256)"]),
  parseAbi(["function mint(uint256,uint256)"]),
  parseAbi(["function publicMint()"]),
  parseAbi(["function freeMint()"]),
  parseAbi(["function claim()"]),
  parseAbi(["function mintTo(address)"]),
];

async function getNewTokens() {
  const out = [];
  for (const type of ["ERC-721", "ERC-1155"]) {
    try {
      const r = await fetch(`${EXPLORER}/tokens?type=${type}&page_size=20`);
      const j = await r.json();
      for (const t of j.items || []) {
        const a = t.address_hash || t.address;
        if (a && !SEEN.has(a.toLowerCase())) out.push({ address: a, name: t.name, symbol: t.symbol, type });
      }
    } catch (e) { log("poll err " + e.message); }
  }
  return out;
}
async function hasMint(address) {
  // probe common mint selectors via eth_call (no gas) to see if mintable
  const selectors = {
    "mint()": "0x1249c58b",
    "mint(uint256)": "0x40d097c3",
    "mint(uint256,uint256)": "0x7c0a830c",
    "publicMint()": "0xad091959",
    "freeMint()": "0xe63b3fe0",
    "claim()": "0x4e71d92d",
  };
  for (const [name, sel] of Object.entries(selectors)) {
    try {
      const res = await publicClient.call({ to: address, data: sel + "0000000000000000000000000000000000000000000000000000000000000000" });
      if (res && !res.startsWith("0x08c379a0")) return name; // not a revert-string error
    } catch {}
  }
  return null;
}

// returns number of mints to attempt: FREE mints -> MAX_MINTS, others -> 1 (costs gas)
function mintCount(mintFn, value) { return value === 0n ? MAX_MINTS : 1; }

async function snipe(address, mintFn, qty = 1) {
  let ok = 0;
  for (let i = 0; i < qty; i++) {
    try {
      log(`SNIPING ${address} [${i + 1}/${qty}] via ${mintFn}`);
      let tx;
      if (mintFn === "mint(uint256)") {
        tx = await walletClient.writeContract({ address, abi: parseAbi(["function mint(uint256)"]), functionName: "mint", args: [BigInt(i)] });
      } else if (mintFn === "mint(uint256,uint256)") {
        tx = await walletClient.writeContract({ address, abi: parseAbi(["function mint(uint256,uint256)"]), functionName: "mint", args: [BigInt(i), 1n] });
      } else if (mintFn === "mintTo(address)") {
        tx = await walletClient.writeContract({ address, abi: parseAbi(["function mintTo(address)"]), functionName: "mintTo", args: [ADDR] });
      } else {
        tx = await walletClient.writeContract({ address, abi: parseAbi([`function ${mintFn}()`]), functionName: mintFn, args: [] });
      }
      log(`MINT TX SENT [${i + 1}/${qty}]: ${tx}`);
      ok++;
    } catch (e) {
      log(`MINT FAILED ${address} [${i + 1}/${qty}]: ${e.shortMessage || e.message}`);
      break; // stop batch on first failure (sold out / limit)
    }
  }
  return ok;
}

async function loop() {
  log("sniper started, wallet " + ADDR);
  while (true) {
    const news = await getNewTokens();
    for (const t of news) {
      SEEN.add(t.address.toLowerCase());
      log(`NEW ${t.type}: ${t.name} (${t.symbol}) ${t.address}`);
      const mintFn = await hasMint(t.address);
      if (mintFn) {
        log(`MINTABLE: ${t.address} -> ${mintFn} | minting x${MAX_MINTS}`);
        await snipe(t.address, mintFn, MAX_MINTS);
      } else {
        log(`no mint fn detected: ${t.address}`);
      }
    }
    await new Promise((r) => setTimeout(r, 15000)); // poll every 15s
  }
}

loop().catch((e) => log("FATAL " + e.message));
