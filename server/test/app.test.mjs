import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { createApp } from "../app.mjs";
import { passwordHash } from "../security.mjs";

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "qr-test-")),
    objects = new Map();
  let timestamp = Date.parse("2026-09-28T12:00:00Z");
  const env = {
    DATA_DIR: dir,
    PUBLIC_URL: "http://127.0.0.1",
    APP_SECRET: "a".repeat(48),
    ADMIN_PASSWORD_HASH: passwordHash("correct password123!"),
  };
  const storage = {
    check: async () => {},
    put: async (key, file, type) => {
      objects.set(key, { bytes: await readFile(file), type });
      return { versionId: "v1" };
    },
    get: async (key) => ({ body: Readable.from(objects.get(key).bytes) }),
    delete: async (key) => {
      objects.delete(key);
    },
  };
  let svc = await createApp({ env, storage, now: () => timestamp });
  let server = svc.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let base = `http://127.0.0.1:${server.address().port}`,
    cookie;
  async function request(
    route,
    { method = "GET", body, token, origin = true, admin = true } = {},
  ) {
    const headers = {};
    if (origin) headers.Origin = env.PUBLIC_URL;
    if (cookie && admin) headers.Cookie = cookie;
    if (token) headers.Authorization = "Bearer " + token;
    if (body && !(body instanceof FormData))
      headers["Content-Type"] = "application/json";
    const response = await fetch(base + route, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    return response;
  }
  async function login() {
    const r = await request("/api/admin/login", {
      method: "POST",
      body: { password: "correct password123!" },
    });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
  }
  async function event(extra = {}) {
    const r = await request("/api/admin/events", {
      method: "POST",
      body: {
        name: "Nunta test",
        location: "Chisinau",
        eventDate: "2026-09-28",
        retentionDays: 7,
        quotaGB: 1,
        maxPhotos: 10,
        ...extra,
      },
    });
    assert.equal(r.status, 201, await r.clone().text());
    const j = await r.json();
    return { ...j, token: j.url.split("=")[1] };
  }
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  async function upload(token, bytes = image) {
    const form = new FormData();
    form.append("photo", new Blob([bytes], { type: "image/png" }), "photo.png");
    return request("/api/album/photos", {
      method: "POST",
      body: form,
      token,
      admin: false,
    });
  }
  t.after(async () => {
    await new Promise((r) => server.close(r));
    svc.close();
    await rm(dir, { recursive: true, force: true });
  });
  return {
    request,
    login,
    event,
    upload,
    objects,
    image,
    async tempFiles() {
      return readdir(path.join(dir, "tmp"));
    },
    async rawUpload(token, body, boundary) {
      return fetch(base + "/api/album/photos", {
        method: "POST",
        headers: {
          Origin: env.PUBLIC_URL,
          Authorization: "Bearer " + token,
          "Content-Type": "multipart/form-data; boundary=" + boundary,
        },
        body,
        duplex: "half",
      });
    },
    get svc() {
      return svc;
    },
    setTime(v) {
      timestamp = v;
    },
    async restart() {
      await new Promise((r) => server.close(r));
      svc.close();
      svc = await createApp({ env, storage, now: () => timestamp });
      server = svc.app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      base = `http://127.0.0.1:${server.address().port}`;
    },
    storage,
  };
}

test("authentication, CSRF, persistent encrypted links and rotation", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/api/admin/events")).status, 401);
  assert.equal(
    (
      await f.request("/api/admin/login", {
        method: "POST",
        origin: false,
        body: { password: "correct password123!" },
      })
    ).status,
    403,
  );
  await f.login();
  const a = await f.event();
  assert.equal((await f.request("/api/album", { token: a.token })).status, 200);
  assert.notEqual(
    f.svc.db.prepare("SELECT token_sealed FROM events").get().token_sealed,
    a.token,
  );
  await f.restart();
  assert.equal(
    (await f.request("/api/admin/events/" + a.event.id + "/link")).status,
    200,
  );
  const rotated = await (
    await f.request("/api/admin/events/" + a.event.id + "/rotate-link", {
      method: "POST",
    })
  ).json();
  assert.equal((await f.request("/api/album", { token: a.token })).status, 404);
  assert.equal(
    (await f.request("/api/album", { token: rotated.url.split("=")[1] }))
      .status,
    200,
  );
});

test("upload/download, guest cannot delete and event isolation", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event(),
    b = await f.event();
  const response = await f.upload(a.token);
  assert.equal(response.status, 201, await response.clone().text());
  const p = (await response.json()).photo;
  const content = await f.request("/api/album/photos/" + p.id + "/content", {
    token: a.token,
  });
  assert.deepEqual(Buffer.from(await content.arrayBuffer()), f.image);
  const thumb = await f.request("/api/album/photos/" + p.id + "/thumbnail", {
    token: a.token,
  });
  assert.equal(thumb.status, 200);
  assert.equal(thumb.headers.get("content-type"), "image/jpeg");
  assert.equal(
    (
      await f.request("/api/album/photos/" + p.id + "/content", {
        token: b.token,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request("/api/album/photos/" + p.id, {
        method: "DELETE",
        token: a.token,
        admin: false,
      })
    ).status,
    404,
  );
  const del = await f.request(
    `/api/admin/events/${a.event.id}/photos/${p.id}`,
    { method: "DELETE" },
  );
  assert.equal(del.status, 200);
  assert.equal(f.objects.size, 0);
});

test("count and byte limits, invalid images, expiry immediate and cleanup", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event({ maxPhotos: 1 });
  assert.equal((await f.upload(a.token, Buffer.from("not image"))).status, 400);
  assert.equal(f.objects.size, 0);
  assert.equal((await f.upload(a.token)).status, 201);
  assert.equal((await f.upload(a.token)).status, 409);
  const reduce = await f.request("/api/admin/events/" + a.event.id, {
    method: "PATCH",
    body: { maxPhotos: 0 },
  });
  assert.equal(reduce.status, 400);
  f.svc.db.prepare("UPDATE events SET quota=1 WHERE id=?").run(a.event.id);
  assert.equal((await f.upload(a.token)).status, 409);
  f.setTime(Date.parse("2026-10-07T00:00:00Z"));
  assert.equal((await f.request("/api/album", { token: a.token })).status, 404);
  await f.svc.cleanup();
  assert.equal(f.objects.size, 0);
});

test("ambiguous upload and failed delete remain tracked and are retried", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event();
  const put = f.storage.put,
    del = f.storage.delete;
  f.storage.put = async (...args) => {
    await put(...args);
    throw Error("lost response");
  };
  f.storage.delete = async () => {
    throw Error("offline");
  };
  assert.equal((await f.upload(a.token)).status, 503);
  assert.equal(f.objects.size, 1);
  assert.ok(
    (await (await f.request("/api/admin/events/" + a.event.id)).json()).event
      .usedBytes > 0,
  );
  assert.equal(
    f.svc.db.prepare("SELECT state FROM photos").get().state,
    "deleting",
  );
  f.storage.delete = del;
  await f.svc.cleanup();
  assert.equal(f.objects.size, 0);
  assert.equal(f.svc.db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
});

test("concurrent uploads reserve capacity before external writes and disabled event rejects finalize", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event({ maxPhotos: 1 });
  let unblock, entered;
  const arrived = new Promise((r) => (entered = r)),
    wait = new Promise((r) => (unblock = r)),
    put = f.storage.put;
  f.storage.put = async (...args) => {
    entered();
    await wait;
    return put(...args);
  };
  const first = f.upload(a.token);
  await arrived;
  assert.equal((await f.upload(a.token)).status, 409);
  assert.equal(
    (
      await f.request("/api/admin/events/" + a.event.id, {
        method: "PATCH",
        body: { disabled: true },
      })
    ).status,
    200,
  );
  unblock();
  assert.equal((await first).status, 404);
  assert.equal(f.objects.size, 0);
  assert.equal(f.svc.db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
});

test("restart reconciles orphaned pending objects and sessions expire/logout", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event();
  const response = await f.upload(a.token);
  assert.equal(response.status, 201);
  f.svc.db.prepare("UPDATE photos SET state='pending',version=NULL").run();
  await f.restart();
  assert.equal(f.objects.size, 0);
  assert.equal(
    (
      await f.request("/api/admin/login", {
        method: "POST",
        body: { password: "wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (await f.request("/api/admin/logout", { method: "POST" })).status,
    200,
  );
  assert.equal((await f.request("/api/admin/session")).status, 401);
});

test("multiple files are rejected and previews enforce event isolation", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event(),
    b = await f.event();
  const form = new FormData();
  form.append("photo", new Blob([f.image]), "one.png");
  form.append("photo", new Blob([f.image]), "two.png");
  assert.equal(
    (
      await f.request("/api/album/photos", {
        method: "POST",
        body: form,
        token: a.token,
      })
    ).status,
    400,
  );
  assert.equal(f.objects.size, 0);
  const response = await f.upload(a.token),
    photo = (await response.json()).photo;
  assert.equal(
    (
      await f.request("/api/album/photos/" + photo.id + "/thumbnail", {
        token: b.token,
      })
    ).status,
    404,
  );
});

test("oversized streaming upload is rejected and temporary partial file removed", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event();
  const boundary = "qrlimitboundary";
  async function* chunks() {
    yield Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`,
    );
    const block = Buffer.alloc(1024 * 1024);
    for (let i = 0; i < 201; i++) yield block;
    yield Buffer.from(`\r\n--${boundary}--\r\n`);
  }
  const result = await f.rawUpload(a.token, Readable.from(chunks()), boundary);
  assert.equal(result.status, 413);
  assert.equal(f.objects.size, 0);
  assert.equal((await f.tempFiles()).length, 0);
});

test("link rotation rejects an old-token upload already writing to storage", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event();
  let unblock, entered;
  const arrived = new Promise((r) => (entered = r)),
    wait = new Promise((r) => (unblock = r)),
    put = f.storage.put;
  f.storage.put = async (...args) => {
    entered();
    await wait;
    return put(...args);
  };
  const first = f.upload(a.token);
  await arrived;
  const rotation = await f.request(
    "/api/admin/events/" + a.event.id + "/rotate-link",
    { method: "POST" },
  );
  assert.equal(rotation.status, 200);
  unblock();
  assert.equal((await first).status, 404);
  assert.equal(f.objects.size, 0);
  assert.equal(f.svc.db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
});

test("retention extension during cleanup protects remaining photos", async (t) => {
  const f = await fixture(t);
  await f.login();
  const a = await f.event();
  assert.equal((await f.upload(a.token)).status, 201);
  assert.equal((await f.upload(a.token)).status, 201);
  f.setTime(Date.parse("2026-10-07T00:00:00Z"));
  await f.login();
  let unblock, entered;
  const arrived = new Promise((r) => (entered = r)),
    wait = new Promise((r) => (unblock = r)),
    del = f.storage.delete;
  let deletes = 0;
  f.storage.delete = async (...args) => {
    deletes++;
    if (deletes === 1) {
      entered();
      await wait;
    }
    return del(...args);
  };
  const cleaning = f.svc.cleanup();
  await arrived;
  const extension = await f.request("/api/admin/events/" + a.event.id, {
    method: "PATCH",
    body: { expiresAt: "2026-11-01T00:00:00Z" },
  });
  assert.equal(extension.status, 200);
  unblock();
  await cleaning;
  assert.equal(deletes, 1);
  assert.equal(f.objects.size, 1);
  assert.equal(
    f.svc.db.prepare("SELECT COUNT(*) n FROM photos WHERE state='ready'").get()
      .n,
    1,
  );
  assert.equal((await f.request("/api/album", { token: a.token })).status, 200);
});
