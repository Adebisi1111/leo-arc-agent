import fs from "fs";
export default function handler(req, res) {
  res.setHeader("content-type", "text/plain");
  try { res.end(fs.readFileSync("/tmp/concord-auth-err.log", "utf8")); }
  catch { res.end("no log yet"); }
}
