import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createStorage } from "./storage.mjs";

const env = {
  B2_ENDPOINT: "https://s3.eu-central-003.backblazeb2.com",
  B2_REGION: "eu-central-003",
  B2_BUCKET: "qr-test-bucket",
  B2_KEY_ID: "test-standard-key-id",
  B2_APPLICATION_KEY: "synthetic-test-value",
};
const key = "qr-forever/event-123/photo-456.jpg";
function storage(handler) {
  return createStorage(env, { client: { send: handler } });
}

test("missing configuration fails closed and master IDs cannot use S3", async () => {
  const adapter = createStorage({});
  assert.equal(adapter.configured, false);
  await assert.rejects(adapter.check(), { code: "STORAGE_NOT_CONFIGURED" });
  assert.throws(() => createStorage({ ...env, B2_KEY_ID: "123456abcdef" }), {
    code: "B2_STANDARD_APPLICATION_KEY_REQUIRED",
  });
  assert.throws(
    () => createStorage({ ...env, B2_ENDPOINT: "https://attacker.example" }),
    { code: "INVALID_B2_ENDPOINT" },
  );
});
test("private bucket check requires owner-only ACL and version-list access", async () => {
  const calls = [];
  const adapter = storage(async (command) => {
    calls.push(command.constructor.name);
    return command.constructor.name === "GetBucketAclCommand"
      ? {
          Owner: { ID: "owner" },
          Grants: [
            {
              Grantee: { Type: "CanonicalUser", ID: "owner" },
              Permission: "FULL_CONTROL",
            },
          ],
        }
      : {};
  });
  assert.deepEqual(await adapter.check(), { configured: true, private: true });
  assert.deepEqual(calls, ["GetBucketAclCommand", "ListObjectVersionsCommand"]);
  await assert.rejects(
    storage(async () => ({
      Owner: { ID: "owner" },
      Grants: [
        {
          Grantee: {
            Type: "Group",
            URI: "http://acs.amazonaws.com/groups/global/AllUsers",
          },
        },
      ],
    })).check(),
    { code: "B2_BUCKET_MUST_BE_PRIVATE" },
  );
  await assert.rejects(storage(async () => ({})).check(), {
    code: "B2_BUCKET_MUST_BE_PRIVATE",
  });
});
test("unknown version cleanup only deletes exact owned key across pages", async () => {
  const removed = [];
  let pages = 0;
  const adapter = storage(async (command) => {
    if (command.constructor.name === "DeleteObjectCommand") {
      removed.push(command.input);
      return {};
    }
    pages++;
    return pages === 1
      ? {
          Versions: [
            { Key: key, VersionId: "one" },
            { Key: key + "-other", VersionId: "no" },
          ],
          IsTruncated: true,
          NextKeyMarker: key,
          NextVersionIdMarker: "one",
        }
      : { DeleteMarkers: [{ Key: key, VersionId: "two" }], IsTruncated: false };
  });
  await adapter.delete(key, null);
  assert.deepEqual(
    removed.map((item) => [item.Key, item.VersionId]),
    [
      [key, "one"],
      [key, "two"],
    ],
  );
  await assert.rejects(adapter.delete("outside/key", null), {
    code: "INVALID_STORAGE_KEY",
  });
  await assert.rejects(adapter.get(key, null), { code: "VERSION_ID_REQUIRED" });
});
test("uploads verify stored bytes, require version ID and never retry ambiguous writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qr-storage-test-"));
  try {
    const file = join(dir, "photo.jpg");
    await writeFile(file, "synthetic bytes");
    const commands = [];
    const adapter = storage(async (command) => {
      commands.push(command.constructor.name);
      if (command.constructor.name === "PutObjectCommand") {
        assert.equal(command.input.Key, key);
        assert.equal(command.input.ServerSideEncryption, "AES256");
        for await (const part of command.input.Body)
          assert.equal(part.toString(), "synthetic bytes");
        return { VersionId: "version-one" };
      }
      assert.equal(command.input.VersionId, "version-one");
      return {
        Body: Readable.from(["synthetic bytes"]),
        ContentType: "image/jpeg",
      };
    });
    assert.deepEqual(await adapter.put(key, file, "image/jpeg"), {
      versionId: "version-one",
    });
    assert.deepEqual(commands, ["PutObjectCommand", "GetObjectCommand"]);
    const corrupt = storage(async (command) =>
      command.constructor.name === "PutObjectCommand"
        ? { VersionId: "version-one" }
        : { Body: Readable.from(["wrong"]) },
    );
    await assert.rejects(corrupt.put(key, file, "image/jpeg"), {
      code: "STORAGE_CHECKSUM_MISMATCH",
    });
    let tries = 0;
    await assert.rejects(
      storage(async () => {
        tries++;
        throw new Error("lost response");
      }).put(key, file, "image/jpeg"),
    );
    assert.equal(tries, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
