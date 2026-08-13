const { createPublicClient, http } = require("viem");
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const T = "0x6d986f25754a88b62152f131ced2285f604d02fa";
const pub = createPublicClient({ transport: http(RPC) });

(async () => {
  // 1. is it a contract? get code
  const code = await pub.getBytecode({ address: T });
  console.log("has bytecode:", !!code && code !== "0x");
  // 2. probe more selectors
  const more = {
    "safeMint(address)": "0x42842e0e",
    "safeMint(address,uint256)": "0x6a627842",
    "safeMint(address,uint256,string)": "0x3b317cf4",
    "mint(address,uint256)": "0x8ab1d731",
    "mintTo(address,uint256)": "0x5a4cec63",
    "obtain()": "0x7b5da83a",
    "redeem()": "0x3d12d2cb",
    "collect()": "0x8f4f88f4",
    "pause()": "0x8456cb59",
  };
  for (const [n, s] of Object.entries(more)) {
    try { const r = await pub.call({ to: T, data: s + "0000000000000000000000000000000000000000000000000000000000000000" });
      console.log(n, "->", r && !r.startsWith("0x08c379a0") ? "RESPONDS" : "revert"); } catch (e) { console.log(n, "-> err", e.shortMessage || e.message); }
  }
  // 3. check token type via Blockscout
  const url = `https://robinhoodchain.blockscout.com/api/v2/tokens/${T}`;
  const j = await (await fetch(url)).json();
  console.log("token type:", j.type, "| name:", j.name, "| symbol:", j.symbol, "| total_supply:", j.total_supply);
})().catch((e) => console.log("ERR", e.message));
