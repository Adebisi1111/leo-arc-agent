import { ethers } from "ethers";
import fs from "fs";

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const RPC = "https://rpc.testnet.arc.network";
const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const vault = new ethers.Contract(VAULT, ["function cancel(uint256)","function subs(uint256) view returns(address,uint256,uint256,uint256,uint256,uint256,bool)","function nextId() view returns(uint256)"], p);

// owner key from wallet.json
const txt = fs.readFileSync("wallet.json","utf8");
const pk = txt.match(/Private key:\s*(0x[0-9a-fA-F]+)/)[1];
const owner = new ethers.Wallet(pk, p);

const isThrottle = (m) => /-32011|request limit|429|timeout|SERVER_ERROR|throttl/i.test(String(m));
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const ts = () => new Date().toISOString();

async function isActive(id) {
  try { const s = await vault.subs(id); return Boolean(s[6]); } catch { return true; }
}

async function main() {
  let nextId = 6;
  try { nextId = Number(await vault.nextId()); } catch(e){ console.log(`[${ts()}] nextId read failed (${e.message}), default 6`); }
  console.log(`[${ts()}] owner ${owner.address} targeting subs 0..${Math.min(nextId,6)-1}`);

  for (let id=0; id<Math.min(nextId,6); id++) {
    if (!(await isActive(id))) { console.log(`[${ts()}] #${id} already inactive, skip`); continue; }
    let done = false;
    for (let attempt=1; attempt<=60 && !done; attempt++) {
      try {
        const tx = await owner.sendTransaction({ to: VAULT, data: vault.interface.encodeFunctionData("cancel",[id]) });
        const rc = await tx.wait();
        console.log(`[${ts()}] CANCELLED #${id} tx ${rc.hash}`);
        done = true;
      } catch(e) {
        if (isThrottle(e.message)) {
          console.log(`[${ts()}] #${id} throttled (attempt ${attempt}), wait 50s`);
          await sleep(50000);
        } else {
          console.log(`[${ts()}] #${id} NON-throttle error: ${e.message}`);
          break;
        }
      }
    }
    if (!done) console.log(`[${ts()}] #${id} NOT cancelled after retries`);
  }
  console.log(`[${ts()}] DONE cancelling old subs`);
}
main().catch(e=>{ console.error("FATAL", e); process.exit(1); });
