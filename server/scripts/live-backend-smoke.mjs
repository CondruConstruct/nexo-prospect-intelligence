// Run only with a temporary, scoped B2 application key supplied in the environment.
// This script prints stage booleans only: no credentials, tokens, object keys or error bodies.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createApp } from "../app.mjs";
import { createStorage } from "../storage.mjs";
import { passwordHash } from "../security.mjs";

const stages = {
  configured: false,
  storagePrivate: false,
  login: false,
  eventCreated: false,
  upload: false,
  list: false,
  contentBytes: false,
  thumbnail: false,
  secondUploadRejected: false,
  wrongTokenRejected: false,
  adminDelete: false,
  deletedPhotoUnavailable: false,
  remoteCleanup: false,
  serverClosed: false,
  localCleanup: false,
};
const tmpRoot = path.resolve(os.tmpdir());
let directory,
  storage,
  svc,
  server,
  cookie = "",
  base = "",
  failed = false;
const tracked = new Set();
function check(value) {
  if (!value) throw new Error("CHECK_FAILED");
}
try {
  const required = [
    "B2_ENDPOINT",
    "B2_REGION",
    "B2_BUCKET",
    "B2_KEY_ID",
    "B2_APPLICATION_KEY",
  ];
  check(
    required.every(
      (name) =>
        typeof process.env[name] === "string" && process.env[name].length > 0,
    ),
  );
  const storageEnv = Object.fromEntries(
    required.map((name) => [name, process.env[name]]),
  );
  storage = createStorage(storageEnv);
  stages.configured = storage.configured === true;
  check(stages.configured);
  await storage.check();
  stages.storagePrivate = true;
  directory = await mkdtemp(path.join(tmpRoot, "qr-live-backend-smoke-"));
  const password = randomBytes(32).toString("base64url");
  const env = {
    NODE_ENV: "test",
    PUBLIC_URL: "http://127.0.0.1",
    DATA_DIR: directory,
    APP_SECRET: randomBytes(48).toString("base64url"),
    ADMIN_PASSWORD_HASH: passwordHash(password),
  };
  const actualPut = storage.put.bind(storage);
  storage.put = async (key, ...rest) => {
    tracked.add(key);
    return actualPut(key, ...rest);
  };
  svc = await createApp({ env, storage });
  server = svc.app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  async function request(
    route,
    { method = "GET", body, token, admin = false } = {},
  ) {
    const headers = { Origin: env.PUBLIC_URL };
    if (admin && cookie) headers.Cookie = cookie;
    if (token) headers.Authorization = "Bearer " + token;
    if (body && !(body instanceof FormData))
      headers["Content-Type"] = "application/json";
    return fetch(base + route, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
      signal: AbortSignal.timeout(360000),
    });
  }
  let response = await request("/api/admin/login", {
    method: "POST",
    body: { password },
  });
  check(response.status === 200);
  cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
  check(cookie.startsWith("qr_session="));
  await response.arrayBuffer();
  stages.login = true;
  response = await request("/api/admin/events", {
    method: "POST",
    admin: true,
    body: {
      name: "Synthetic smoke " + randomUUID(),
      location: "Synthetic test only",
      eventDate: new Date().toISOString().slice(0, 10),
      quotaGB: 0.001,
      maxPhotos: 1,
      retentionDays: 1,
    },
  });
  check(response.status === 201);
  const event = await response.json();
  check(event.event?.id && event.url);
  const token = new URLSearchParams(new URL(event.url).hash.slice(1)).get(
    "event",
  );
  check(token);
  stages.eventCreated = true;
  const image = await sharp({
    create: { width: 24, height: 24, channels: 3, background: "#5A3CF0" },
  })
    .png()
    .toBuffer();
  async function upload() {
    const form = new FormData();
    form.append(
      "photo",
      new Blob([image], { type: "image/png" }),
      "synthetic-smoke.png",
    );
    return request("/api/album/photos", { method: "POST", body: form, token });
  }
  response = await upload();
  check(response.status === 201);
  const photo = (await response.json()).photo;
  check(photo?.id);
  stages.upload = true;
  response = await request("/api/album/photos", { token });
  check(response.status === 200);
  const list = await response.json();
  check(list.photos?.length === 1 && list.photos[0].id === photo.id);
  stages.list = true;
  response = await request(
    "/api/album/photos/" + encodeURIComponent(photo.id) + "/content",
    { token },
  );
  check(response.status === 200);
  check(Buffer.from(await response.arrayBuffer()).equals(image));
  stages.contentBytes = true;
  response = await request(
    "/api/album/photos/" + encodeURIComponent(photo.id) + "/thumbnail",
    { token },
  );
  check(
    response.status === 200 &&
      response.headers.get("content-type")?.startsWith("image/jpeg"),
  );
  const thumb = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  check(
    thumb.format === "jpeg" &&
      thumb.width > 0 &&
      thumb.width <= 600 &&
      thumb.height > 0 &&
      thumb.height <= 600,
  );
  stages.thumbnail = true;
  response = await upload();
  check(response.status === 409);
  await response.arrayBuffer();
  stages.secondUploadRejected = true;
  response = await request("/api/album", {
    token: randomBytes(32).toString("base64url"),
  });
  check(response.status === 404);
  await response.arrayBuffer();
  stages.wrongTokenRejected = true;
  response = await request(
    "/api/admin/events/" +
      encodeURIComponent(event.event.id) +
      "/photos/" +
      encodeURIComponent(photo.id),
    { method: "DELETE", admin: true },
  );
  check(response.status === 200);
  await response.arrayBuffer();
  stages.adminDelete = true;
  response = await request(
    "/api/album/photos/" + encodeURIComponent(photo.id) + "/content",
    { token },
  );
  check(response.status === 404);
  await response.arrayBuffer();
  stages.deletedPhotoUnavailable = true;
} catch {
  failed = true;
} finally {
  // Stop incoming traffic and finish in-flight handlers before reading the private test DB.
  if (server) {
    try {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      stages.serverClosed = true;
    } catch {
      failed = true;
    }
  } else stages.serverClosed = true;
  try {
    if (svc)
      for (const row of svc.db.prepare("SELECT key FROM photos").all())
        tracked.add(row.key);
  } catch {
    failed = true;
  }
  let clean = true;
  // Each key was generated by this isolated app/database, never discovered by a bucket-wide scan.
  for (const key of tracked) {
    try {
      await storage.delete(key);
    } catch {
      clean = false;
    }
  }
  stages.remoteCleanup = clean;
  if (!clean) failed = true;
  if (svc) {
    try {
      svc.close();
    } catch {
      failed = true;
    }
  }
  if (directory) {
    try {
      const target = path.resolve(directory);
      check(
        path.dirname(target) === tmpRoot &&
          path.basename(target).startsWith("qr-live-backend-smoke-") &&
          target !== tmpRoot,
      );
      await rm(target, { recursive: true, force: true });
      stages.localCleanup = true;
    } catch {
      failed = true;
    }
  } else stages.localCleanup = true;
  console.log(
    JSON.stringify({
      ok: !failed && Object.values(stages).every(Boolean),
      stages,
    }),
  );
  process.exitCode = failed || !Object.values(stages).every(Boolean) ? 1 : 0;
}
