// Shared store via GitHub repo file (agents.json).
// Vercel writes config here on Activate; VPS cron reads + updates lastRun.
const REPO = "Adebisi1111/leo-arc-agent";
const PATH = "agents.json";
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;

function ghFetch(method, body) {
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  return fetch(API, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

export async function load() {
  try {
    const r = await ghFetch("GET");
    if (!r.ok) return { agents: {} };
    const j = await r.json();
    return JSON.parse(Buffer.from(j.content, "base64").toString());
  } catch { return { agents: {} }; }
}
export async function save(data) {
  try {
    let sha;
    try { const g = await ghFetch("GET"); if (g.ok) sha = (await g.json()).sha; } catch {}
    const body = {
      message: "agent config update",
      content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
      ...(sha ? { sha } : {}),
    };
    await ghFetch("PUT", body);
  } catch (e) {}
}
