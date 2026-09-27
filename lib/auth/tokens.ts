import { randomBytes, createHash } from "node:crypto";

/**
 * Shared by session cookies and password-reset links (BUILD-PLAN §4): the raw token
 * goes to the client (cookie or email link), only its SHA-256 hash is stored in the
 * database, so a leaked database dump doesn't hand out usable tokens.
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
