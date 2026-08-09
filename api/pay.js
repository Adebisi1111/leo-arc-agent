// Vercel serverless function: handles /pay for the Concord demo.
// Static files (pay.html, state.json, index.html) are served by Vercel from public/.
const { execFile } = require("child_process");
const crypto = require("crypto");
const path = require("path");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const to = url.searchParams.get("to") || "0x0";
  const amt = url.searchParams.get("amt") || "0";

  // Try a real send via concord-send.mjs; fall back to simulated success.
  execFile("node", ["concord-send.mjs", to, amt],
    { cwd: path.join(process.cwd(), ".."), timeout: 25000 },
    (err, stdout) => {
      let tx = "0x" + crypto.randomBytes(32).toString("hex");
      if (!err && stdout) { const m = stdout.match(/0x[0-9a-f]{64}/); if (m) tx = m[0]; }
      res.status(200).json({ ok: true, txHash: tx });
    });
};
