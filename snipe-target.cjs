const { createPublicClient, createWalletClient, http, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const fs = require("fs");
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const PK = fs.readFileSync(".env.rh", "utf8").match(/RH_WALLET_PK=(0x[0-9a-f]+)/)[1];
const ADDR = fs.readFileSync(".env.rh", "utf8").match(/RH_WALLET_ADDRESS=(0x[0-9a-fA-F]+)/)[1];
const acct = privateKeyToAccount(PK);
const pub = createPublicClient({ transport: http(RPC) });
const wal = createWalletClient({ account: acct, transport: http(RPC) });
const T = "0x6d986f25754a88b62152f131ced2285f604d02fa";
const selectors = { "mint()": "0x1249c58b", "mint(uint256)": "0x40d097c3", "mint(uint256,uint256)": "0x7c0a830c", "publicMint()": "0xad091959", "freeMint()": "0xe63b3fe0", "claim()": "0x4e71d92d" };

(async () => {
  let fn = null;
  for (const [n, s] of Object.entries(selectors)) {
    try { const r = await pub.call({ to: T, data: s + "0000000000000000000000000000000000000000000000000000000000000000" });
      if (r && !r.startsWith("0x08c379a0")) { fn = n; break; } } catch (e) {}
  }
  console.log("mint fn:", fn || "NONE");
  if (!fn) { console.log("no mint fn detected"); return; }
  for (let i = 0; i < 5; i++) {
    try {
      let tx;
      if (fn === "mint(uint256)") tx = await wal.writeContract({ address: T, abi: parseAbi(["function mint(uint256)"]), functionName: "mint", args: [BigInt(i)] });
      else if (fn === "mint(uint256,uint256)") tx = await wal.writeContract({ address: T, abi: parseAbi(["function mint(uint256,uint256)"]), functionName: "mint", args: [BigInt(i), 1n] });
      else if (fn === "mintTo(address)") tx = await wal.writeContract({ address: T, abi: parseAbi(["function mintTo(address)"]), functionName: "mintTo", args: [ADDR] });
      else tx = await wal.writeContract({ address: T, abi: parseAbi([`function ${fn}()`]), functionName: fn, args: [] });
      console.log("MINT", i + 1, "tx:", tx);
    } catch (e) { console.log("MINT", i + 1, "FAILED:", e.shortMessage || e.message); break; }
  }
})();
