# Leo — Team Showcase Sheet

> **Present in ~5 minutes. Works for web3 and non-web3 people alike.**

---

## 30-second pitch

> **Leo is a boss who never forgets payday.**
> It's an autonomous agent that pays recurring USDC — payroll and subscriptions — on Arc, executed and detected entirely through Circle. It runs hands-off every 20 minutes. A normal person can watch it work on a simple dashboard — no wallets, no gas, no contract jargon.

*(The payroll framing is the strongest story: "an agent that pays workers on time, every time" is something anyone understands — and it's the same engine that pays a coffee subscription.)*

---

## Live demo (the 7 beats)

| # | Do this | What they see |
|---|---|---|
| 1 | Open `https://stingray-science-liquid.ngrok-free.dev/dashboard` on a screen | The dashboard: "Leo pays people on time — automatically" + active subs as plain bills |
| 2 | Point at **"Leo Inc. Payroll — Worker A"** | A real recurring payroll sub, $1/day, auto-paid |
| 3 | Say: *"It runs every 20 minutes. When a sub is due, Circle pays it."* | The loop explained simply |
| 4 | Open the tx proof: `0x7e6c8584ef789eb582691bd09d3fa94f8b35ce0cf2d8d53562391ab3143ea93a` in an Arc explorer | A **real on-chain payment**, not a mock |
| 5 | Show repo `github.com/Adebisi1111/leo-arc-agent` → "Proof of real activity" | Public, verifiable, payroll-led |
| 6 | (Technical beat) Mention the clever bit: **Circle SCP submits the tx** so it beats Arc's public-RPC throttle; **Circle Event Monitor** detects the `Paid` event and fires a webhook back | The engineering insight, for technical teammates |
| 7 | (Optional) Trigger a tick live and watch a sub pay + the `Paid` webhook fire | They see it *happen*, not a screenshot |

---

## Proof it's real (refer to these)

- **On-chain tx:** `0x7e6c8584ef789eb582691bd09d3fa94f8b35ce0cf2d8d53562391ab3143ea93a` (block 52109832)
- **Live `Paid` webhook:** delivered to the agent endpoint (13:33:43 UTC)
- **Circle API activity:** 54 calls, 96.3% success, 0 server errors
- **ERC-8004 agent identity:** registered on-chain, #851166
- **Autonomy:** a daily anchor sub guarantees ≥1 real on-chain tx/day, no human in the loop

---

## Honest attribution (say this if asked)

> *"I designed and directed Leo end-to-end. The implementation was AI-assisted — I made the architecture calls, validated every step, claimed the faucet, ran the agent, and verified the real transactions. Every build decision was mine; the code was written with AI tooling."*

**What's yours and fully defensible:**
- The concept (autonomous payroll agent on Arc)
- The architecture decisions (Circle rails to beat the RPC throttle, daily anchor for ≥1 tx/day, payroll framing)
- The hands-on operation (funding, running, verifying every on-chain result)
- The direction of every iteration

If pushed on a technical detail you don't hand-write: *"I set that rule — e.g. the vault only lets the Circle agent or owner call `pay()`. I can pull the contract if you want the line-by-line."* That's competent and truthful.

---

## One-line closer

> *"It's a working autonomous agent that moves real money on a schedule, proven on-chain, and a normal person can watch it. That's the agentic economy."*

---

*Repo: github.com/Adebisi1111/leo-arc-agent · Dashboard: stingray-science-liquid.ngrok-free.dev/dashboard*
*Arc testnet (chain 5042002) · Circle Smart Contract Platform + Event Monitor · ERC-8004 #851166*
