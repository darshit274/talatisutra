import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

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
