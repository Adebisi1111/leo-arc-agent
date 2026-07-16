# Leo — Arc Y (AutoSub): Autonomous USDC Subscription Agent

> An autonomous on-chain agent that pays recurring USDC subscriptions on **Arc testnet**, executed and monitored entirely through **Circle** infrastructure — no manual transactions, no RPC throttling.

Built for the **Encode Club × Arc Hackathon** (Agentic Economy track).

---

## What it does

Leo is an autonomous agent that manages recurring subscription payments on-chain:

1. **Detects** when a subscription is due (reads the `SubscriptionVault` contract).
2. **Executes** the payment via **Circle Smart Contract Platform** — Circle submits the transaction from its own infrastructure, bypassing Arc's public-RPC rate limits.
3. **Monitors** the on-chain `Paid` event via a **Circle Event Monitor**, which pushes a webhook to a live endpoint.
4. **Runs autonomously** on a 20-minute heartbeat — no human in the loop.

---

## Architecture

```
[ every 20 min ]  cron heartbeat
        │
        ▼
  circle-tick.mjs  ──reads due subs──►  Circle Smart Contract Platform
        │                                 executes vault.pay(id)
        │                                        │
        │                                        ▼
        │                                on-chain Paid event (Arc testnet)
        │                                        │
        ▼                                        ▼
  (next cycle) ◄── Circle Event Monitor ── fires webhook ──► receiver logs it
```

| Layer | Technology | Role |
|---|---|---|
| **Identity** | ERC-8004 on-chain agent identity | Verifiable agent registration |
| **Contract** | `SubscriptionVault.sol` (Arc testnet) | Holds subs, enforces `agent`/`owner` auth |
| **Execution** | Circle Smart Contract Platform (SCP) | Submits `pay()` — bypasses Arc RPC throttle |
| **Detection** | Circle Event Monitor | Watches `Paid`, delivers webhook |
| **Autonomy** | Scheduled tick (`circle-tick.mjs`) | Decides + acts every 20 min |

---

## Why Circle?

Arc's public RPC rate-limits direct transaction submission (`-32011`). Routing execution through **Circle's Smart Contract Platform** solves this: Circle submits from its own infrastructure, so the agent never touches the throttled endpoint. Payment **detection** is likewise offloaded to Circle's **Event Monitor** rather than polling the chain.

This makes Leo a clean example of an **agent built on Circle rails**: Circle is both the *hands* (execution) and the *eyes* (event detection).

---

## Key contracts & addresses (Arc testnet)

| Item | Address |
|---|---|
| SubscriptionVault | `0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F` |
| Circle agent wallet | `0x76bc3241c19e277b16e3159513cf4f27c9c2577a` |
| USDC (Arc testnet) | `0x3600000000000000000000000000000000000000` |
| `Paid` event topic | `0x59e5c638e8e7ab669e805847b18203cf00e4ab4d0688c3da8e486aba4cc4fed2` |

Chain ID: **5042002** · RPC: `https://rpc.testnet.arc.network`

---

## Repository layout

| File | Purpose |
|---|---|
| `src/SubscriptionVault.sol` | The subscription vault contract |
| `circle-client.mjs` | Shared Circle SDK client (SCP + wallets) |
| `circle-tick.mjs` | **Main autonomous tick** — fund/pay logic |
| `circle-import-and-monitor.mjs` | Imports vault to SCP + creates Event Monitor |
| `create-circle-wallet.mjs` | Creates the Circle-managed agent wallet |
| `register-entity-secret.mjs` | Generates + registers Circle entity secret |
| `setup-circle-agent.mjs` | Sets Circle wallet as vault agent + funds gas |
| `webhook_receiver.mjs` | Local endpoint that logs Circle `Paid` webhooks |
| `fix-intervals.mjs` | Registers realistic subscriptions (1d / 3d / 7d) |
| `.env.example` | Environment template (no secrets) |

---

## Running it

```bash
# 1. install deps
npm install

# 2. configure credentials
cp .env.example .env      # then fill in your Circle API key + entity secret

# 3. one-time setup
node register-entity-secret.mjs      # generate + register entity secret
node create-circle-wallet.mjs        # create Circle agent wallet
node setup-circle-agent.mjs          # set as vault agent
node circle-import-and-monitor.mjs   # import vault + create Event Monitor

# 4. run the autonomous tick (or schedule it every 20 min)
node --env-file=.env circle-tick.mjs
```

---

## Security

- **No private keys or secrets** are committed. `.env`, wallet files, and Circle recovery files are `.gitignore`d.
- All credentials load from environment variables at runtime.
- Testnet only.

---

## Status

✅ Circle-native execution proven on-chain
✅ Circle Event Monitor + webhook delivery confirmed
✅ Autonomous 20-minute tick running
✅ Realistic subscriptions (1d / 3d / 7d) registered

---

*Built on Arc testnet with Circle Developer-Controlled Wallets + Smart Contract Platform.*
