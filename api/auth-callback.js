// Google OAuth callback -> create/restore Arc agent wallet per user
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "fs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT = "https://arc-autopay.vercel.app/api/auth-callback";
const DB = "/tmp/concord-users.json";
const ERR = "/tmp/concord-auth-err.log";
function logErr(m) { try { fs.appendFileSync(ERR, `[${new Date().toISOString()}] ${m}\n`); } catch {} }
function load() { try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return {}; } }
function save(d) { try { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); } catch (e) { logErr("save fail " + e.message); } }

function makeSession(user) {
  return Buffer.from(JSON.stringify({ sub: user.sub, email: user.email, address: user.address, walletId: user.walletId })).toString("base64url");
}

export default async function handler(req, res) {
  const url = new URL(req.url, "https://arc-autopay.vercel.app");
  const code = url.searchParams.get("code");
  if (!code) return res.status(400).json({ error: "no code" });
  try {
    logErr("callback hit, exchanging code");
    const tk = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
    }).then((r) => r.json());
    if (!tk.access_token) { logErr("token failed " + JSON.stringify(tk)); return res.status(401).json({ error: "token failed", detail: tk }); }
    logErr("token ok, fetching profile");

    const prof = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tk.access_token}` },
    }).then((r) => r.json());
    const sub = prof.sub, email = prof.email;
    logErr("profile " + email);

    const db = load();
    let user = db[sub];
    if (!user) {
      logErr("creating arc wallet");
      try {
        const client = initiateDeveloperControlledWalletsClient({
          apiKey: process.env.CIRCLE_API_KEY,
          entitySecret: process.env.CIRCLE_ENTITY_SECRET,
        });
        const w = await client.createWallets({
          walletSetId: process.env.CIRCLE_WALLET_SET_ID,
          blockchains: ["ARC-TESTNET"],
          count: 1,
        });
        const w0 = w.data.wallets[0];
        user = { sub, email, walletId: w0.id, address: w0.address, created: new Date().toISOString() };
        db[sub] = user; save(db);
        logErr("wallet created " + w0.address);
        // starter fund from pool (faucet forbidden on Arc)
        try {
          await client.createTransaction({
            walletId: "a4fb2d3f",
            tokenId: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
            destinationAddress: w0.address,
            amount: ["1"],
            fee: { type: "level", config: { feeLevel: "MEDIUM" } },
          });
          logErr("funded starter");
        } catch (e) { logErr("fund warn " + e.message); }
      } catch (e) {
        logErr("wallet create FAIL " + e.message);
        // fallback: still log in with a placeholder so user isn't bounced
        user = { sub, email, walletId: "pending", address: "pending", created: new Date().toISOString() };
        db[sub] = user; save(db);
      }
    }

    // register Gmail -> Arc address in shared directory (for Gmail-based recipients)
    try {
      const { register } = await import("./directory.js");
      if (user.address && user.address !== "pending") await register(email, user.address);
    } catch (e) { logErr("dir reg warn " + e.message); }

    const sess = makeSession(user);
    res.setHeader("Set-Cookie", `concord_sess=${sess}; Path=/; Max-Age=86400; SameSite=Lax`);
    res.writeHead(302, { Location: `/?loggedin=1&sess=${sess}` });
    res.end();
  } catch (e) {
    const msg = encodeURIComponent((e.message || "unknown") + " | " + (e.stack || "").slice(0, 200));
    res.writeHead(302, { Location: `/?loginerr=${msg}` });
    res.end();
  }
}
