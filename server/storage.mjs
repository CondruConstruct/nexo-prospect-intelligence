import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  GetBucketAclCommand,
} from "@aws-sdk/client-s3";

const required = [
  "B2_ENDPOINT",
  "B2_REGION",
  "B2_BUCKET",
  "B2_KEY_ID",
  "B2_APPLICATION_KEY",
];
const failure = (code) => Object.assign(new Error(code), { code });
function ownedKey(key) {
  if (
    typeof key !== "string" ||
    !/^qr-forever\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(key) ||
    key.includes("..")
  )
    throw failure("INVALID_STORAGE_KEY");
}
async function digest(stream) {
  const hash = createHash("sha256");
  for await (const part of stream) hash.update(part);
  return hash.digest("hex");
}

// Only server-side configuration is accepted. Never expose this object or SDK errors to clients.
export function createStorage(env = process.env, { client } = {}) {
  if (required.some((name) => !env[name])) {
    const unavailable = async () => {
      throw failure("STORAGE_NOT_CONFIGURED");
    };
    return {
      configured: false,
      check: unavailable,
      put: unavailable,
      get: unavailable,
      delete: unavailable,
    };
  }
  const endpoint = new URL(env.B2_ENDPOINT);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== `s3.${env.B2_REGION}.backblazeb2.com` ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/"
  )
    throw failure("INVALID_B2_ENDPOINT");
  if (!/^[a-zA-Z0-9-]{6,63}$/.test(env.B2_BUCKET))
    throw failure("INVALID_B2_BUCKET");
  // B2 master IDs are the 12-character account ID; S3 requires a standard application key.
  if (/^[a-f0-9]{12}$/i.test(env.B2_KEY_ID))
    throw failure("B2_STANDARD_APPLICATION_KEY_REQUIRED");
  const sdk =
    client ||
    new S3Client({
      endpoint: endpoint.origin,
      region: env.B2_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.B2_KEY_ID,
        secretAccessKey: env.B2_APPLICATION_KEY,
      },
      maxAttempts: 1, // Retrying PutObject can create an untracked B2 version after a lost response.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      requestHandler: { connectionTimeout: 10000, requestTimeout: 300000 },
    });
  const Bucket = env.B2_BUCKET;
  async function get(key, versionId, { signal } = {}) {
    ownedKey(key);
    if (!versionId || versionId === "null")
      throw failure("VERSION_ID_REQUIRED");
    const response = await sdk.send(
      new GetObjectCommand({ Bucket, Key: key, VersionId: versionId }),
      { abortSignal: signal },
    );
    if (
      !response.Body ||
      typeof response.Body[Symbol.asyncIterator] !== "function"
    )
      throw failure("INVALID_STORAGE_BODY");
    return {
      body: response.Body,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
    };
  }
  async function remove(key, versionId) {
    ownedKey(key);
    if (versionId && versionId !== "null") {
      try {
        await sdk.send(
          new DeleteObjectCommand({ Bucket, Key: key, VersionId: versionId }),
        );
      } catch (error) {
        if (!["NoSuchKey", "NoSuchVersion"].includes(error.name)) throw error;
      }
      return;
    }
    // Unique photo keys are persisted BEFORE upload. Reconcile every version of only that key.
    let KeyMarker, VersionIdMarker;
    const seen = new Set();
    do {
      const page = await sdk.send(
        new ListObjectVersionsCommand({
          Bucket,
          Prefix: key,
          MaxKeys: 1000,
          KeyMarker,
          VersionIdMarker,
        }),
      );
      for (const item of [
        ...(page.Versions || []),
        ...(page.DeleteMarkers || []),
      ]) {
        if (item.Key === key) {
          if (!item.VersionId || item.VersionId === "null")
            throw failure("VERSION_ID_REQUIRED");
          await remove(key, item.VersionId);
        }
      }
      if (!page.IsTruncated) break;
      const cursor = JSON.stringify([
        page.NextKeyMarker,
        page.NextVersionIdMarker,
      ]);
      if (!page.NextKeyMarker || seen.has(cursor))
        throw failure("INVALID_STORAGE_PAGINATION");
      seen.add(cursor);
      KeyMarker = page.NextKeyMarker;
      VersionIdMarker = page.NextVersionIdMarker;
    } while (true);
  }
  return {
    configured: true,
    async check() {
      const acl = await sdk.send(new GetBucketAclCommand({ Bucket }));
      // Require a positively identified owner-only ACL, not merely absence of AllUsers.
      if (
        !acl.Owner?.ID ||
        !acl.Grants?.length ||
        acl.Grants.some(
          (grant) =>
            grant.Grantee?.Type !== "CanonicalUser" ||
            grant.Grantee.ID !== acl.Owner.ID,
        )
      )
        throw failure("B2_BUCKET_MUST_BE_PRIVATE");
      await sdk.send(
        new ListObjectVersionsCommand({
          Bucket,
          Prefix: "qr-forever/",
          MaxKeys: 1,
        }),
      );
      return { configured: true, private: true };
    },
    async put(key, filePath, contentType) {
      ownedKey(key);
      const info = await stat(filePath);
      if (!info.isFile() || info.size === 0)
        throw failure("INVALID_UPLOAD_FILE");
      const sha256 = await digest(createReadStream(filePath));
      const input = createReadStream(filePath);
      let response;
      try {
        response = await sdk.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body: input,
            ContentLength: info.size,
            ContentType: contentType,
            Metadata: { sha256 },
            CacheControl: "private, no-store",
            ServerSideEncryption: "AES256",
          }),
        );
      } finally {
        input.destroy();
      }
      if (!response.VersionId || response.VersionId === "null")
        throw failure("VERSION_ID_REQUIRED");
      // Verify actual stored bytes rather than assuming a successful HTTP response or ETag means integrity.
      const stored = await get(key, response.VersionId);
      if ((await digest(stored.body)) !== sha256)
        throw failure("STORAGE_CHECKSUM_MISMATCH");
      return { versionId: response.VersionId };
    },
    get,
    delete: remove,
  };
}
