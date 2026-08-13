// Returns Google OAuth authorization URL
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT = "https://arc-autopay.vercel.app/api/auth-callback";

export default function handler(req, res) {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  }).toString();
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ url }));
}
