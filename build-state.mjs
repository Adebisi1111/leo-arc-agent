// build-state.mjs — reads the vault and writes public/state.json (human-readable, NO secrets).
// Safe against Arc read-throttle: falls back to a stale cache rather than crashing.
import { ethers } from "ethers";
import fs from "fs";

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const USDC = "0x3600000000000000000000000000000000000000";
const RPC = "https://rpc.testnet.arc.network";
const p = new ethers.JsonRpcProvider(RPC, 5042002, { staticNetwork: true });
const vault = new ethers.Contract(VAULT, [
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns(uint256)",
], p);
const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns(uint256)"], p);
const withTimeout = (pr, ms, label) => Promise.race([pr, new Promise((_, r) => setTimeout(() => r(new Error(label + " TIMEOUT")), ms))]);

let META = {};
try { META = JSON.parse(fs.readFileSync("subs-meta.json", "utf8")); } catch {}

const CACHE = "public/state.json";
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { return null; } }

async function main() {
  const out = {
    agent: "Leo (Arc Y — AutoSub)",
    description: "An autonomous agent that pays recurring USDC — salaries and subscriptions — on Arc. Like a boss who never forgets payday.",
    vault: VAULT,
    chain: "Arc testnet",
    updatedAt: new Date().toISOString(),
    walletFunded: false,
    vaultBalance: 0,
    subscriptions: [],
  };

  try { out.vaultBalance = Number(await withTimeout(usdc.balanceOf(VAULT), 8000, "vaultBal")) / 1e6; } catch { const c = loadCache(); out.vaultBalance = c ? c.vaultBalance : 0; }
  try { const w = Number(await withTimeout(usdc.balanceOf(process.env["CIRCLE_WALLET_ADDRESS"] || VAULT), 8000, "walletBal")); out.walletFunded = w > 0.3e6; } catch {}

  let nextId = 9;
  try { nextId = Number(await withTimeout(vault.nextId(), 8000, "nextId")); } catch { const c = loadCache(); nextId = c && c._nextId ? c._nextId : 9; }

  const now = Math.floor(Date.now() / 1000);
  for (let id = 0; id < nextId; id++) {
    let s;
    try { s = await withTimeout(vault.subs(id), 6000, "sub" + id); }
    catch { await new Promise(r => setTimeout(r, 1200)); continue; } // throttle backoff, skip this one
    await new Promise(r => setTimeout(r, 400)); // small gap between reads to avoid 429
    const [recipient, amount, interval, cycles, paid, nextDue, active] = s;
    if (!active) continue;
    const meta = META[String(id)] || {};
    if (!meta.name) continue; // hide unnamed/test subs from the human dashboard
    const due = now >= Number(nextDue);
    const done = cycles !== 0n && paid >= cycles;
    out.subscriptions.push({
      id,
      name: meta.name || `Subscription #${id}`,
      emoji: meta.emoji || "📦",
      category: meta.category || "Subscription",
      note: meta.note || "",
      amountUSDC: Number(amount) / 1e6,
      intervalSeconds: Number(interval),
      intervalLabel: humanInterval(Number(interval)),
      cycles: Number(cycles),
      paidCount: Number(paid),
      remaining: cycles === 0n ? "∞" : Math.max(0, Number(cycles) - Number(paid)),
      nextDueAt: new Date(Number(nextDue) * 1000).toISOString(),
      nextDueLabel: humanWhen(Number(nextDue), now),
      status: done ? "completed" : due ? "due now" : "scheduled",
      recipient,
    });
  }
  out._nextId = nextId;
  // Lead with payroll so the strongest narrative shows first
  out.subscriptions.sort((a, b) => (a.category === "Payroll" ? -1 : 0) - (b.category === "Payroll" ? -1 : 0) || a.id - b.id);

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(out, null, 2));
  console.log(`state.json written: ${out.subscriptions.length} subs, vault ${out.vaultBalance} USDC`);
}
main().catch(e => { console.error("build-state failed:", e.message); process.exit(0); });

function humanInterval(sec) {
  if (sec >= 86400 * 7) return `${sec / 86400 / 7} week(s)`;
  if (sec >= 86400) return `${sec / 86400} day(s)`;
  if (sec >= 3600) return `${sec / 3600} hour(s)`;
  if (sec >= 60) return `${sec / 60} min`;
  return `${sec}s`;
}
function humanWhen(ts, now) {
  const d = Number(ts) - now;
  if (d <= 0) return "due now";
  if (d >= 86400) return `in ${Math.round(d / 86400)} day(s)`;
  if (d >= 3600) return `in ${Math.round(d / 3600)} hour(s)`;
  if (d >= 60) return `in ${Math.round(d / 60)} min`;
  return `in ${d}s`;
}
