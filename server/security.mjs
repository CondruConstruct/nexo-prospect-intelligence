import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export const hash = (v) => createHash("sha256").update(v).digest("hex");
export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password, encoded) {
  try {
    const [salt, digest] = encoded.split(":");
    const actual = scryptSync(password, salt, 64),
      expected = Buffer.from(digest, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
export function seal(value, secret) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", Buffer.from(hash(secret), "hex"), iv);
  return Buffer.concat([
    iv,
    c.update(value),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64");
}
export function unseal(value, secret) {
  const b = Buffer.from(value, "base64"),
    d = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(hash(secret), "hex"),
      b.subarray(0, 12),
    );
  d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString();
}
