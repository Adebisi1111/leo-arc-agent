// Watcher for a specific gated contract (beeple ERC721SeaDrop)
// Polls getPublicDrop / mintSeaDrop probe; when public mint opens, snipes from funded wallet.
const { createPublicClient, createWalletClient, http, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const fs = require("fs");
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const PK = fs.readFileSync(".env.rh", "utf8").match(/RH_WALLET_PK=(0x[0-9a-f]+)/)[1];
const ADDR = fs.readFileSync(".env.rh", "utf8").match(/RH_WALLET_ADDRESS=(0x[0-9a-fA-F]+)/)[1];
const TARGET = "0x6d986f25754a88b62152f131ced2285f604d02fa";
const acct = privateKeyToAccount(PK);
const pub = createPublicClient({ transport: http(RPC) });
const wal = createWalletClient({ account: acct, transport: http(RPC) });
const LOG = "rh-watch.log";
function log(m) { const s = `[${new Date().toISOString()}] ${m}`; console.log(s); fs.appendFileSync(LOG, s + "\n"); }

const dropAbi = [{
  type: "function", name: "getPublicDrop", stateMutability: "view", inputs: [],
  outputs: [{
    name: "publicDrop", type: "tuple", components: [
      { name: "publicDropAddress", type: "address" },
      { name: "feeBps", type: "uint16" },
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "maxMintsPerWallet", type: "uint64" },
      { name: "price", type: "uint96" },
      { name: "enabled", type: "bool" }
    ]
  }]
}, {
  type: "function", name: "mintSeaDrop", stateMutability: "nonpayable",
  inputs: [{ name: "minter", type: "address" }, { name: "quantity", type: "uint256" }]
}];

async function isOpen() {
  try {
    const d = await pub.readContract({ address: TARGET, abi: dropAbi, functionName: "getPublicDrop", args: [] });
    if (d && d.enabled) return { open: true, price: d.price, max: d.maxMintsPerWallet };
    return { open: false };
  } catch {
    try {
      await pub.call({ to: TARGET, data: "0x9badd4cb" + ADDR.slice(2).padStart(64, "0") + "1".padStart(64, "0") });
      return { open: true, probe: true };
    } catch { return { open: false }; }
  }
}

async function mint(qty = 5) {
  for (let i = 0; i < qty; i++) {
    try {
      const tx = await wal.writeContract({ address: TARGET, abi: parseAbi(["function mintSeaDrop(address,uint256)"]), functionName: "mintSeaDrop", args: [ADDR, 1n] });
      log(`WATCH MINT [${i + 1}/${qty}] tx: ${tx}`);
    } catch (e) {
      log(`WATCH MINT FAILED [${i + 1}/${qty}]: ${e.shortMessage || e.message}`);
      break;
    }
  }
}

(async () => {
  log("watcher started for " + TARGET);
  let minted = false;
  while (!minted) {
    const st = await isOpen();
    if (st.open) {
      log(`PUBLIC MINT OPEN (price=${st.price} max=${st.max}) -> SNIPING`);
      await mint(5);
      minted = true;
      log("watcher done (mint attempted)");
    } else {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 20000));
    }
  }
})().catch((e) => log("WATCHER FATAL " + e.message));
