// Persistent store for agent configs. Writes to agents.json and git-commits+pushes
// so it survives Vercel's ephemeral filesystem.
import fs from "fs";
import { execSync } from "child_process";

const FILE = "/tmp/concord-agents.json"; // runtime copy
const REPO = process.cwd();

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { agents: {} }; }
}
function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  // persist to repo so it survives redeploys
  try {
    fs.writeFileSync(REPO + "/agents.json", JSON.stringify(data, null, 2));
    execSync(`git add agents.json && git commit -m "agent config update" && git push origin master`, { cwd: REPO, stdio: "ignore" });
  } catch (e) { /* best-effort; runtime /tmp still holds it */ }
}
export { load, save };
