// Vercel serverless function: handles /pay for the Concord demo.
// Does a REAL USDC transfer on ARC-TESTNET via the Circle SDK (inline, no child process).
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const to = url.searchParams.get("to");
  const amt = url.searchParams.get("amt") || "0.01";

  if (!to || to === "0x0") {
    res.status(400).json({ error: "missing recipient" });
    return;
  }

  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    });
    const resp = await client.createTransaction({
      walletId: process.env.CIRCLE_WALLET_ID,
      tokenId: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
      destinationAddress: to,
      amounts: [String(amt)],
      blockchain: "ARC-TESTNET",
      fee: { type: "level", config: { feeLevel: "LOW" } },
    });
    const id = resp?.data?.id;
    const state = resp?.data?.state;
    res.status(200).json({ ok: true, id, state, real: true });
  } catch (e) {
    // surface real error instead of faking a hash
    res.status(200).json({
      ok: false,
      error: e?.message || "send failed",
      code: e?.code,
      real: false,
    });
  }
};
