/**
 * TikTok credentials. TIKTOK_MODE=sandbox uses the sandbox key/secret
 * (private posts, target users only); anything else uses production.
 */
export function tiktokCreds(): { key?: string; secret?: string; sandbox: boolean } {
  const sandbox = (process.env.TIKTOK_MODE ?? "").toLowerCase() === "sandbox";
  return sandbox
    ? { key: process.env.TIKTOK_SANDBOX_CLIENT_KEY, secret: process.env.TIKTOK_SANDBOX_CLIENT_SECRET, sandbox }
    : { key: process.env.TIKTOK_CLIENT_KEY, secret: process.env.TIKTOK_CLIENT_SECRET, sandbox };
}
