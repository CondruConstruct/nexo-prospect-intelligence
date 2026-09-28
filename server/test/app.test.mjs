import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { createApp, createImageGate } from "../app.mjs";
import { passwordHash } from "../security.mjs";
import { crc32 } from "node:zlib";
import { randomUUID } from "node:crypto";

test('admin event pagination reaches every event and rejects invalid page sizes', async t => {
  const f=await fixture(t); await f.login();
  await f.event(); await f.event(); await f.event();
  const first=await (await f.request('/api/admin/events?offset=0&limit=2')).json();
  assert.equal(first.events.length,2);
  assert.equal(first.nextOffset,2);
  const last=await (await f.request('/api/admin/events?offset=2&limit=2')).json();
  assert.equal(last.events.length,1);
  assert.equal(last.nextOffset,null);
  assert.equal(new Set([...first.events,...last.events].map(e=>e.id)).size,3);
  assert.equal((await f.request('/api/admin/events?limit=1000')).status,400);
  assert.equal((await f.request('/api/admin/events?offset=-1')).status,400);
});

test('photo descriptions persist as plain text and reject long input without quota or temp leftovers', async t => {
  const f=await fixture(t); await f.login(); const a=await f.event();
  const description='Mireasa și mirele — <script>alert(1)</script> & familie';
  const uploaded=await f.upload(a.token,f.image,'  '+description+'  ');
  assert.equal(uploaded.status,201);
  assert.equal((await uploaded.json()).photo.description,description);
  await f.restart();
  const list=await (await f.request('/api/album/photos',{token:a.token})).json();
  assert.equal(list.photos[0].description,description);
  const admin=await (await f.request('/api/admin/events/'+a.event.id+'/photos')).json();
  assert.equal(admin.photos[0].description,description);
  assert.equal((await f.upload(a.token,f.image,'x'.repeat(501))).status,400);
  assert.equal(f.objects.size,1);
  assert.equal(f.svc.db.prepare('SELECT COUNT(*) n FROM photos').get().n,1);
  // Unlink is awaited in the route finally, which may settle just after the response arrives.
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await f.tempFiles(),[]);
  const plain=await f.upload(a.token);
  assert.equal((await plain.json()).photo.description,'');
});

test('description migration preserves existing photo rows on an old database', async t => {
  const f=await fixture(t); await f.login(); const a=await f.event(); await f.upload(a.token);
  f.svc.db.exec('ALTER TABLE photos DROP COLUMN description');
  await f.restart();
  const list=await (await f.request('/api/album/photos',{token:a.token})).json();
  assert.equal(list.photos.length,1);
  assert.equal(list.photos[0].description,'');
  assert.equal(f.objects.size,1);
});

test('archive file budget rejects whole album without truncation and permits selection', async t => {
  const f=await fixture(t,{MAX_ARCHIVE_FILES:'1'}); await f.login(); const a=await f.event();
  await f.upload(a.token); await f.upload(a.token);
  const ticket=(ids)=>f.request('/api/album/download-ticket',{method:'POST',token:a.token,body:{photoIds:ids}});
  assert.equal((await ticket(null)).status,413);
  const list=await (await f.request('/api/album/photos',{token:a.token})).json();
  const selected=[list.photos[0].id];
  for(let n=0;n<5;n++) assert.equal((await ticket(selected)).status,200);
  assert.equal((await ticket(selected)).status,429);
  f.setTime(Date.parse('2026-09-28T12:02:01Z'));
  assert.equal((await ticket(selected)).status,200);
});

test('archive concurrency keeps queued grant valid and reads originals sequentially', async t => {
  const f=await fixture(t); await f.login(); const a=await f.event();
  await f.upload(a.token); await f.upload(a.token);
  const create=()=>f.request('/api/album/download-ticket',{method:'POST',token:a.token,body:{photoIds:null}});
  const first=await (await create()).json(), second=await (await create()).json();
  let release, calls=0;
  const gate=new Promise(resolve=>release=resolve), original=f.storage.get;
  f.storage.get=async(...args)=>{
    calls++;
    if(calls===1) await gate;
    return original(...args);
  };
  const response=await f.request(first.downloadUrl);
  assert.equal(calls,1);
  assert.equal((await create()).status,503);
  assert.equal((await f.request(second.downloadUrl)).status,503);
  release();
  assert.equal(unzipStored(Buffer.from(await response.arrayBuffer())).length,2);
  assert.equal(calls,2);
  const retry=await f.request(second.downloadUrl);
  assert.equal(retry.status,200);
  await retry.arrayBuffer();
  const large=await f.request('/api/album/download-ticket',{method:'POST',token:a.token,
    body:{photoIds:Array.from({length:1000},()=>randomUUID())}});
  assert.equal(large.status,404,'1000 IDs accepted by JSON parser, then rejected as unknown');
});

function unzipStored(bytes) {
  const end = bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  assert.ok(end >= 0, 'complete ZIP central directory');
  let offset = bytes.readUInt32LE(end + 16);
  const entries = [];
  for (let n=0;n<bytes.readUInt16LE(end+10);n++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    assert.equal(bytes.readUInt16LE(offset+10),0);
    const size=bytes.readUInt32LE(offset+24), nameLength=bytes.readUInt16LE(offset+28);
    const name=bytes.subarray(offset+46,offset+46+nameLength).toString();
    const local=bytes.readUInt32LE(offset+42);
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    const content=bytes.subarray(start,start+size);
    assert.equal(crc32(content),bytes.readUInt32LE(offset+16));
    entries.push({name,bytes:content});
    offset+=46+nameLength+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
  }
  return entries;
}
test('ZIP originals, selection isolation, single-use and revoked grants', async t => {
  const f=await fixture(t); await f.login();
  const a=await f.event(), b=await f.event();
  await f.upload(a.token); await f.upload(a.token); await f.upload(b.token);
  const list=await (await f.request('/api/album/photos',{token:a.token})).json();
  const foreign=await (await f.request('/api/album/photos',{token:b.token})).json();
  const ticket=async (ids=null,token=a.token)=>f.request('/api/album/download-ticket',{method:'POST',token,body:{photoIds:ids}});
  assert.equal((await ticket([foreign.photos[0].id])).status,404);
  assert.equal((await ticket([])).status,400);
  let grant=await (await ticket()).json();
  assert.equal(grant.photoCount,2);
  let result=await f.request(grant.downloadUrl,{admin:false,origin:false});
  assert.equal(result.status,200);
  assert.match(result.headers.get('content-disposition'),/attachment/);
  let entries=unzipStored(Buffer.from(await result.arrayBuffer()));
  assert.equal(entries.length,2);
  for (const entry of entries) { assert.match(entry.name,/^photo-000[12]\.png$/); assert.deepEqual(entry.bytes,f.image); }
  assert.equal((await f.request(grant.downloadUrl)).status,404);
  grant=await (await ticket([list.photos[0].id])).json();
  entries=unzipStored(Buffer.from(await (await f.request(grant.downloadUrl)).arrayBuffer()));
  assert.equal(entries.length,1);
  grant=await (await ticket()).json();
  f.setTime(Date.parse('2026-09-28T12:02:01Z'));
  assert.equal((await f.request(grant.downloadUrl)).status,404);
  grant=await (await ticket()).json();
  await f.request(`/api/admin/events/${a.event.id}/rotate-link`,{method:'POST'});
  assert.equal((await f.request(grant.downloadUrl)).status,404);
  grant=await (await ticket(null,b.token)).json();
  await f.request(`/api/admin/events/${b.event.id}`,{method:'PATCH',body:{disabled:true}});
  assert.equal((await f.request(grant.downloadUrl)).status,404);
});
test('ZIP source failure aborts transfer and recovers archive capacity', async t => {
  const f=await fixture(t); await f.login(); const a=await f.event(); await f.upload(a.token);
  const ticket=async()=> (await f.request('/api/album/download-ticket',{method:'POST',token:a.token,body:{photoIds:null}})).json();
  const original=f.storage.get;
  f.storage.get=async()=>({body:Readable.from((async function*(){yield Buffer.from('partial');throw new Error('upstream failed')})())});
  let grant=await ticket();
  await assert.rejects(async()=>{const result=await f.request(grant.downloadUrl);await result.arrayBuffer();});
  f.storage.get=original;
  grant=await ticket();
  const result=await f.request(grant.downloadUrl);
  assert.equal(unzipStored(Buffer.from(await result.arrayBuffer())).length,1);
});

async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "qr-test-")),
    objects = new Map();
  let timestamp = Date.parse("2026-09-28T12:00:00Z");
  const env = {
    DATA_DIR: dir,
    PUBLIC_URL: "http://127.0.0.1",
    APP_SECRET: "a".repeat(48),
    ADMIN_PASSWORD_HASH: passwordHash("correct password123!"),
    ...overrides,
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
  async function upload(token, bytes = image, description) {
    const form = new FormData();
    form.append("photo", new Blob([bytes], { type: "image/png" }), "photo.png");
    if (description !== undefined) form.append("description", description);
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

test("count and byte limits, invalid images, expiry immediate and 72-hour cleanup grace", async (t) => {
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
  assert.equal(f.objects.size, 1);
  const deletion = Date.parse(a.event.expiresAt) + 3 * 86400000;
  f.setTime(deletion - 1);
  await f.svc.cleanup();
  assert.equal(f.objects.size, 1);
  f.setTime(deletion);
  await f.svc.cleanup();
  assert.equal(f.objects.size, 0);
});

test('expiry grace is visible to admin, extending expiry protects stored photos', async t => {
  const f=await fixture(t); await f.login(); const a=await f.event();
  await f.upload(a.token);
  const expiry=Date.parse(a.event.expiresAt), deletion=expiry+3*86400000;
  assert.equal(a.event.inGracePeriod,false);
  assert.equal(a.event.retentionStatus,'active');
  assert.equal(a.event.deletionAt,new Date(deletion).toISOString());
  f.setTime(expiry); await f.login();
  assert.equal((await f.request('/api/album',{token:a.token})).status,404);
  const grace=await (await f.request('/api/admin/events/'+a.event.id)).json();
  assert.equal(grace.event.inGracePeriod,true);
  assert.equal(grace.event.expired,true);
  assert.equal(grace.event.retentionStatus,'grace');
  await f.restart();
  assert.equal(f.objects.size,1,'restart preserves ready images during grace');
  const extended=await f.request('/api/admin/events/'+a.event.id,{method:'PATCH',
    body:{expiresAt:new Date(expiry+7*86400000).toISOString()}});
  assert.equal(extended.status,200);
  const event=(await extended.json()).event;
  assert.equal(event.inGracePeriod,false);
  assert.equal(event.deletionAt,new Date(deletion+7*86400000).toISOString());
  f.setTime(deletion);
  await f.svc.cleanup();
  assert.equal(f.objects.size,1);
  assert.equal((await f.request('/api/album',{token:a.token})).status,200);
});

test('explicit admin deletion stays immediate during expiry grace', async t => {
  const f=await fixture(t); await f.login(); const a=await f.event(); await f.upload(a.token);
  const photos=await (await f.request('/api/admin/events/'+a.event.id+'/photos')).json();
  f.setTime(Date.parse(a.event.expiresAt)+1000); await f.login();
  const response=await f.request('/api/admin/events/'+a.event.id+'/photos/'+photos.photos[0].id,{method:'DELETE'});
  assert.equal(response.status,200);
  assert.equal(f.objects.size,0);
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
  f.setTime(Date.parse("2026-10-10T00:00:00Z"));
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


test("shared image gate rejects excess work and recovers idempotently", () => {
  const acquire = createImageGate(1);
  const release = acquire();
  assert.throws(() => acquire(), { status: 503 });
  release(); release();
  const releaseNext = acquire();
  assert.throws(() => acquire(), { status: 503 });
  releaseNext();
});

test("configured pixel limit is advertised and oversized images leave no objects", async (t) => {
  const f = await fixture(t, { MAX_IMAGE_PIXELS: "1000000", MAX_UPLOAD_CONCURRENCY: "1", MAX_THUMBNAIL_CONCURRENCY: "1", IMAGE_PROCESS_CONCURRENCY: "1" });
  await f.login();
  const e = await f.event();
  const info = await (await f.request("/api/album", { token: e.token })).json();
  assert.equal(info.event.maxImagePixels, 1000000);
  assert.equal(info.event.maxFileBytes, 200 * 1024 * 1024);
  const oversized = await sharp({ create: { width: 1001, height: 1000, channels: 3, background: "red" } }).png().toBuffer();
  assert.equal((await f.upload(e.token, oversized)).status, 400);
  assert.equal(f.objects.size, 0);
  assert.equal((await f.upload(e.token)).status, 201);
  assert.deepEqual(await f.tempFiles(), []);
});


test("single upload profile rejects concurrency while B2 is pending and recovers", async (t) => {
  const f = await fixture(t, { MAX_UPLOAD_CONCURRENCY: "1", IMAGE_PROCESS_CONCURRENCY: "1" });
  await f.login();
  const e = await f.event();
  let enter, release;
  const started = new Promise(r => { enter = r; });
  const held = new Promise(r => { release = r; });
  const originalPut = f.storage.put;
  f.storage.put = async (...args) => { enter(); await held; return originalPut(...args); };
  const first = f.upload(e.token);
  await started;
  try { assert.equal((await f.upload(e.token)).status, 503); }
  finally { release(); }
  assert.equal((await first).status, 201);
  assert.equal((await f.upload(e.token)).status, 201);
});
