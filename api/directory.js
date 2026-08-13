// Shared Gmail -> Arc wallet directory, backed by GitHub repo file (directory.json).
// On login, a user's Gmail + Arc address are registered. Recipients can then be
// referenced by Gmail and resolved to their agent wallet.
const REPO = "Adebisi1111/leo-arc-agent";
const PATH = "directory.json";
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;

async function ghFetch(method, body) {
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
    if (!r.ok) return {};
    const j = await r.json();
    return JSON.parse(Buffer.from(j.content, "base64").toString());
  } catch { return {}; }
}
export async function save(dir) {
  try {
    let sha;
    try { const g = await ghFetch("GET"); if (g.ok) sha = (await g.json()).sha; } catch {}
    const body = {
      message: "directory update",
      content: Buffer.from(JSON.stringify(dir, null, 2)).toString("base64"),
      ...(sha ? { sha } : {}),
    };
    await ghFetch("PUT", body);
  } catch (e) {}
}
// register a gmail -> address mapping
export async function register(gmail, address) {
  const dir = await load();
  dir[gmail.toLowerCase()] = address;
  await save(dir);
}
// resolve a recipient ref (gmail or 0x address) to an address
export async function resolve(ref) {
  if (ref.startsWith("0x")) return ref;
  const dir = await load();
  return dir[ref.toLowerCase()] || null;
}
