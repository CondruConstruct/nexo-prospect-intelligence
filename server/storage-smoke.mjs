import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorage } from "./storage.mjs";

const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC",
  "base64",
);
const expected = createHash("sha256").update(bytes).digest("hex");
const key = `qr-forever/test-${randomUUID()}/${randomUUID()}.png`;
let storage,
  versionId,
  directory,
  attempted = false;
let stage = "configuration";
try {
  storage = createStorage(process.env);
  stage = "private-bucket-check";
  await storage.check();
  directory = await mkdtemp(join(tmpdir(), "qr-b2-smoke-"));
  const file = join(directory, "synthetic.png");
  await writeFile(file, bytes);
  stage = "upload";
  attempted = true;
  ({ versionId } = await storage.put(key, file, "image/png"));
  stage = "download-integrity";
  const download = await storage.get(key, versionId);
  const hash = createHash("sha256");
  for await (const part of download.body) hash.update(part);
  if (hash.digest("hex") !== expected) throw new Error("checksum mismatch");
  stage = "delete";
  await storage.delete(key, versionId);
  stage = "verify-deletion";
  let missing = false;
  try {
    const downloaded = await storage.get(key, versionId);
    downloaded.body.destroy();
  } catch (error) {
    missing =
      error.$metadata?.httpStatusCode === 404 ||
      ["NoSuchKey", "NoSuchVersion", "NotFound"].includes(error.name);
    if (!missing) throw error;
  }
  if (!missing) throw new Error("deleted version remained readable");
  console.log(
    JSON.stringify({
      ok: true,
      privateBucket: true,
      uploaded: true,
      sha256Matched: true,
      exactVersionDeleted: true,
      deletedVersionUnavailable: true,
    }),
  );
} catch {
  console.error(JSON.stringify({ ok: false, failedStage: stage }));
  process.exitCode = 1;
} finally {
  if (attempted && storage) {
    try {
      await storage.delete(key, null);
    } catch {
      console.error(
        JSON.stringify({ ok: false, failedStage: "final-cleanup" }),
      );
      process.exitCode = 1;
    }
  }
  if (directory) await rm(directory, { recursive: true, force: true });
}
