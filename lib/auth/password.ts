import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const BCRYPT_COST = 12;

// No 0/O/1/l/I — a temp password gets read off a screen or typed from an email.
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Generates the temporary password an admin-created account (or an admin-set
 * password) ships in its email (BUILD-PLAN §4/§5). ~70 bits of entropy — plenty for
 * a one-time credential the user is forced to replace on first login. */
export function generateTempPassword(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const byte of bytes) {
    out += TEMP_PASSWORD_CHARS[byte % TEMP_PASSWORD_CHARS.length];
  }
  return out;
}

// A precomputed hash of a random value, unrelated to any real account. Used to keep
// login timing consistent whether or not the submitted email exists, so an attacker
// can't distinguish "no such user" from "wrong password" by response time.
const DUMMY_HASH = "$2b$12$gxvS.FaYybLguTEslsFRi.Q9s1.ku2BdPvGkNK16CW3ydPM/8NACm";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
