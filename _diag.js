const fs = require("fs");
const { ethers } = require("ethers");
const RPC = "https://arc-testnet.rpc.thirdweb.com";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const VAULT_ABI = ["function nextId() view returns (uint256)","function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)"];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)"];
const LOG = "C:\\Users\\Administrator\\arc-autopay\\_diag.log";
const log = (m) => fs.appendFileSync(LOG, m + "\n");
fs.writeFileSync(LOG, "");
(async () => {
  const t0 = Date.now();
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, provider);
  const nextId = Number(await vault.nextId());
  const now = Math.floor(Date.now()/1000);
  let due = 0;
  for (let id=0; id<nextId; id++){ const s = await vault.subs(id); if (s[6] && Number(s[5])<=now) due++; }
  const bal = await usdc.balanceOf(VAULT);
  log(`WORK_DONE t=${Date.now()-t0}ms nextId=${nextId} due=${due} vaultBal=${Number(bal)/1e6}`);
  const te = setTimeout(()=>{ log(`STILL_ALIVE_AT_${Date.now()-t0}ms (hang confirmed)`); process.exit(2); }, 8000);
  te.unref();
  log("returning from async work; if you see STILL_ALIVE the process hangs");
})().catch(e => { log("ERR "+String(e).split("\n")[0]); process.exit(1); });
