import { passwordHash } from "../security.mjs";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const output = process.argv[2] || ".env";
if (!process.stdin.isTTY) {
  console.error("Run in an interactive terminal.");
  process.exit(1);
}
process.stdout.write(
  "Administrator password (at least 14 characters; input hidden): ",
);
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
await new Promise((resolve, reject) => {
  process.stdin.on("data", (chunk) => {
    for (const c of chunk.toString()) {
      if (c === "\u0003") {
        process.stdin.setRawMode(false);
        process.exit(1);
      } else if (c === "\r" || c === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
        return;
      } else if (c === "\u007f" || c === "\b") password = password.slice(0, -1);
      else password += c;
    }
  });
});
process.stdout.write("\n");
if (password.length < 14)
  throw new Error("Use a password with at least 14 characters.");
await writeFile(
  output,
  `NODE_ENV=production\nPUBLIC_URL=https://jbpsuport.online\nHOST=127.0.0.1\nPORT=3000\nDATA_DIR=/data\nAPP_SECRET=${randomBytes(48).toString("base64url")}\nADMIN_PASSWORD_HASH=${passwordHash(password)}\nB2_ENDPOINT=\nB2_REGION=\nB2_BUCKET=\nB2_KEY_ID=\nB2_APPLICATION_KEY=\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Private configuration created. Edit the B2 settings locally. Existing files are never overwritten.",
);
process.exit(0);
