// Concord demo server: serves dashboard + pay screen, executes REAL USDC sends via Circle.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 8090;
const PUBLIC = path.join(__dirname, "public");

const MIME = { ".html":"text/html", ".json":"application/json", ".js":"text/javascript" };

const server = http.createServer((req, res) => {
  // POST /pay?to=&amt=  -> execute real send
  if (req.method === "POST" && req.url.startsWith("/pay")) {
    const u = new URL(req.url, "http://x");
    const to = u.searchParams.get("to");
    const amt = u.searchParams.get("amt");
    if (!to || !amt) { res.writeHead(400); return res.end(JSON.stringify({ok:false,error:"missing to/amt"})); }
    // call the real concord-send.mjs
    execFile("node", ["concord-send.mjs", to, amt], { cwd: __dirname, timeout: 60000 }, (err, stdout) => {
      const m = stdout.match(/OK id=([a-f0-9-]+)/);
      const txm = stdout.match(/tx hash:\s*(0x[0-9a-f]+)/);
      if (err && !m) { res.writeHead(200); return res.end(JSON.stringify({ok:false, error: String(err.message||err).slice(0,120), tx: txm?txm[1]:null})); }
      res.writeHead(200);
      res.end(JSON.stringify({ ok:true, tx: txm?txm[1]:("circle-"+ (m?m[1]:"pending")) }));
    });
    return;
  }
  // static files
  let p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const fp = path.join(PUBLIC, p);
  fs.readFile(fp, (e, data) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "text/plain" });
    res.end(data);
  });
});
server.listen(PORT, () => console.log("Concord demo server on", PORT));
