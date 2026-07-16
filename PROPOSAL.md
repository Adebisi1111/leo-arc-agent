# Leo — The Robot That Pays People On Time

> **One-liner:** Leo is an autonomous agent that pays recurring USDC — **payroll and subscriptions** — on Arc testnet, executed and monitored entirely through Circle. Think of a **boss who never forgets payday.**

---

## What is Leo? (child version)

Leo is a **tiny robot assistant** that lives in the computer. A boss tells Leo: *"Pay each of my workers $50 every Friday."* Leo does it — by itself, on time, every single week. The boss never has to remember, click, or worry.

The same engine also pays **recurring bills** (coffee, groceries, Netflix) — but payroll is the headline: a boss who never misses payday is a story anyone understands.

## Why did I build it?

Think of a boss with workers. Every Friday he must pay them. But he's busy, he travels, he forgets. Sometimes payday is late and workers are upset.

Leo is the **perfect assistant** who handles payday for him — automatically, forever, even while the boss is asleep.

I built Leo for the **Encode Club × Arc Hackathon** (Agentic Economy track — robots that do real jobs for people online).

## What problem does it fix?

Paying people again and again is hard for a computer to do *by itself*. The internet has **traffic cops** (the "throttle") that block busy roads, so normal computers get stuck and the payment fails.

Leo is special: it uses **Circle's private road** instead of the crowded public one. So Leo never gets stuck — the money always reaches the worker on time.

## How does Leo work? (simple version)

1. Every **20 minutes**, Leo wakes up and checks: *"Is anyone's payday today?"*
2. If yes, Leo asks **Circle** (the trusted money-mover) to send the coins from the boss's piggy bank to the worker.
3. When the coins arrive, **Circle rings a bell** ("done!") back to Leo.
4. Leo goes back to sleep. The boss did nothing.

*(The same loop also pays recurring bills — Leo doesn't care if the payee is a worker or a coffee shop.)*

## How do we know it's real?

We watched it happen for real on the Arc practice playground (testnet):

- Leo sent a real coin payment → receipt `0x7e6c8584ef789eb582691bd09d3fa94f8b35ce0cf2d8d53562391ab3143ea93a`
- The bell rang to prove it arrived (`Paid` webhook, 13:33:43 UTC)
- A normal person can open Leo's screen and **see the payment happened** — no confusing computer words

## Why does this matter?

Leo proves a robot can be **trusted with money** — it pays people on time, every time, without a human. That helps real bosses, real workers, and anyone who hates missing a payment. It's a working **agentic-economy primitive**: autonomous, recurring USDC payouts.

---

## Short version (contest form)

> **Name:** Leo
> **What it is:** A robot that pays recurring USDC payroll and subscriptions automatically — like a boss who never forgets payday.
> **Problem:** Computers can't easily pay the same person again and again by themselves; they get stuck on busy public roads.
> **Fix:** Leo uses Circle's road to send the money and gets a "done!" bell back, all on its own every 20 minutes.
> **Proof:** Real payment on Arc, receipt `0x7e6c8584…`, bell confirmed. Live dashboard: stingray-science-liquid.ngrok-free.dev/dashboard
> **Why it's cool:** A normal person watches Leo pay people on a simple screen — no wallet/gas/contract words needed.

---

*Primary use-case: **autonomous payroll**. Secondary: any recurring USDC payment (subscriptions, bills, salaries).*
