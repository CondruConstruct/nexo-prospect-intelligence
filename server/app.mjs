import express from "express";
import { registerDownloads } from "./downloads.mjs";
import multer from "multer";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, unlink, stat, readdir, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { hash, passwordMatches, seal, unseal } from "./security.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fail = (status, message) => Object.assign(new Error(message), { status });
const MB = 1024 * 1024;
const EXPIRY_GRACE_MS = 3 * 24 * 3600000;
sharp.cache({ memory: 16, files: 0, items: 50 });
sharp.concurrency(1);
export function createImageGate(capacity) {
  let active = 0;
  return () => {
    if (active >= capacity) throw fail(503, "Server ocupat. Reîncercați în câteva secunde.");
    active++;
    let released = false;
    return () => { if (!released) { released = true; active--; } };
  };
}
export async function createApp({
  env = process.env,
  storage,
  now = () => Date.now(),
} = {}) {
  if (!env.APP_SECRET || env.APP_SECRET.length < 32)
    throw new Error("APP_SECRET must be at least 32 characters.");
  if (
    !env.ADMIN_PASSWORD_HASH ||
    !/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(env.ADMIN_PASSWORD_HASH)
  )
    throw new Error("ADMIN_PASSWORD_HASH is required.");
  function resourceLimit(name, fallback, min, max) {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    return value;
  }
  const maxImagePixels = resourceLimit("MAX_IMAGE_PIXELS", 80000000, 1000000, 80000000);
  const maxUploadConcurrency = resourceLimit("MAX_UPLOAD_CONCURRENCY", 4, 1, 4);
  const maxThumbnailConcurrency = resourceLimit("MAX_THUMBNAIL_CONCURRENCY", 2, 1, 2);
  const acquireImage = createImageGate(resourceLimit("IMAGE_PROCESS_CONCURRENCY", 2, 1, 2));
  const maxFileBytes = 200 * MB;
  const origin = new URL(env.PUBLIC_URL).origin,
    production = env.NODE_ENV === "production";
  if (production && !origin.startsWith("https://"))
    throw new Error("PUBLIC_URL must use HTTPS in production.");
  const data = path.resolve(env.DATA_DIR || path.join(here, "data")),
    tmp = path.join(data, "tmp");
  await mkdir(tmp, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(data, "qr.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,name TEXT NOT NULL,location TEXT NOT NULL,event_date TEXT NOT NULL,quota INTEGER NOT NULL,max_photos INTEGER,expires TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,token_hash TEXT UNIQUE NOT NULL,token_sealed TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES events(id),name TEXT NOT NULL,bytes INTEGER NOT NULL,key TEXT UNIQUE NOT NULL,version TEXT,type TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','ready','deleting')),created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS photo_event ON photos(event_id,state,created,id);
    CREATE INDEX IF NOT EXISTS event_expiry ON events(expires);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);`);
  // Additive migration keeps existing production albums and photo rows intact.
  if (!db.prepare("PRAGMA table_info(photos)").all().some(column => column.name === "description"))
    db.exec("ALTER TABLE photos ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", express.json({ limit: "64kb" }));
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return next(fail(403, "Origine nepermisă."));
    next();
  });
  const iso = () => new Date(now()).toISOString();
  function rate(req, key, limit, period) {
    const k = key + ":" + req.ip,
      time = now();
    db.prepare("DELETE FROM rate_limits WHERE reset < ?").run(time);
    const r = db.prepare("SELECT * FROM rate_limits WHERE key=?").get(k);
    if (r && r.count >= limit)
      throw fail(429, "Prea multe încercări. Reîncercați mai târziu.");
    db.prepare(
      "INSERT INTO rate_limits(key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    ).run(k, time + period);
  }
  function session(req, res, next) {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("qr_session="))
      ?.slice(11);
    if (
      !raw ||
      !db
        .prepare("SELECT hash FROM sessions WHERE hash=? AND expires>?")
        .get(hash(raw), now())
    )
      return next(fail(401, "Autentificare necesară."));
    req.sessionHash = hash(raw);
    next();
  }
  const counts = (id) =>
    db
      .prepare(
        "SELECT COALESCE(SUM(bytes),0) bytes,COUNT(*) count FROM photos WHERE event_id=?",
      )
      .get(id);
  function view(e) {
    const c = counts(e.id);
    const expiry = Date.parse(e.expires), deletion = expiry + EXPIRY_GRACE_MS;
    return {
      id: e.id,
      name: e.name,
      location: e.location,
      eventDate: e.event_date,
      quotaGB: e.quota / 1024 ** 3,
      quotaBytes: e.quota,
      maxPhotos: e.max_photos,
      expiresAt: e.expires,
      deletionAt: new Date(deletion).toISOString(),
      expired: now() >= expiry,
      inGracePeriod: now() >= expiry && now() < deletion,
      retentionStatus: now() < expiry ? "active" : now() < deletion ? "grace" : "deletion_due",
      disabled: !!e.disabled,
      usedBytes: c.bytes,
      photoCount: db
        .prepare(
          "SELECT COUNT(*) n FROM photos WHERE event_id=? AND state='ready'",
        )
        .get(e.id).n,
      createdAt: e.created,
      storageConfigured: storageReady,
      maxImagePixels,
      maxFileBytes,
    };
  }
  const find = (id) => {
    const e = db.prepare("SELECT * FROM events WHERE id=?").get(id);
    if (!e) throw fail(404, "Eveniment negăsit.");
    return e;
  };
  function guest(req, res, next) {
    try {
      const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
        req.get("authorization") || "",
      )?.[1];
      const e =
        token &&
        db
          .prepare(
            "SELECT * FROM events WHERE token_hash=? AND disabled=0 AND expires>?",
          )
          .get(hash(token), iso());
      if (!e) throw fail(404, "Album indisponibil sau expirat.");
      req.event = e;
      next();
    } catch (e) {
      next(e);
    }
  }
  function text(v, max, label) {
    if (typeof v !== "string" || !v.trim() || v.trim().length > max)
      throw fail(400, label + " este invalid.");
    return v.trim();
  }
  function validDate(s) {
    if (
      typeof s !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      !Number.isFinite(Date.parse(s + "T00:00:00Z")) ||
      new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
    )
      throw fail(400, "Data evenimentului este invalidă.");
    return s;
  }
  function quota(v) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0.001 || v > 10000)
      throw fail(400, "Spațiul trebuie să fie între 0,001 și 10000 GB.");
    return Math.floor(v * 1024 ** 3);
  }
  function maxPhotos(v) {
    if (v === null) return null;
    if (!Number.isInteger(v) || v < 1 || v > 1000000)
      throw fail(400, "Limita de fotografii este invalidă.");
    return v;
  }
  function expiration(date, days) {
    if (!Number.isInteger(days) || days < 1 || days > 3650)
      throw fail(400, "Durata trebuie să fie între 1 și 3650 zile.");
    return new Date(
      Date.parse(date + "T23:59:59.999Z") + days * 86400000,
    ).toISOString();
  }
  function link(e) {
    return `${origin}/album.html#event=${unseal(e.token_sealed, env.APP_SECRET)}`;
  }
  const photoView = (p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    bytes: p.bytes,
    createdAt: p.created,
  });
  let storageReady = false,
    cleanupRunning = false;
  async function verifyStorage() {
    try {
      await storage.check();
      storageReady = true;
      return true;
    } catch {
      storageReady = false;
      return false;
    }
  }
  const requireStorage = (req, res, next) =>
    storageReady
      ? next()
      : next(fail(503, "Stocarea nu este conectată. Reîncercați mai târziu."));
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, storageConfigured: storageReady }),
  );
  app.post("/api/admin/login", (req, res, next) => {
    try {
      rate(req, "login", 8, 15 * 60 * 1000);
      if (
        (req.body.username !== undefined && req.body.username !== "admin") ||
        typeof req.body.password !== "string" ||
        req.body.password.length > 1024 ||
        !passwordMatches(req.body.password, env.ADMIN_PASSWORD_HASH)
      )
        throw fail(401, "Parolă incorectă.");
      const token = randomBytes(32).toString("base64url");
      db.prepare("DELETE FROM sessions WHERE expires<?").run(now());
      db.prepare("INSERT INTO sessions VALUES (?,?)").run(
        hash(token),
        now() + 8 * 3600000,
      );
      res.cookie("qr_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: production,
        path: "/api/admin",
        maxAge: 8 * 3600000,
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api/admin", session);
  app.get("/api/admin/session", (req, res) =>
    res.json({ authenticated: true, storageConfigured: storageReady }),
  );
  app.post("/api/admin/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE hash=?").run(req.sessionHash);
    res.clearCookie("qr_session", {
      path: "/api/admin",
      httpOnly: true,
      sameSite: "strict",
      secure: production,
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/events", (req, res, next) => {
    try {
      const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
      const limit = req.query.limit === undefined ? 250 : Number(req.query.limit);
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 250 ||
          (req.query.offset !== undefined && !/^\d+$/.test(req.query.offset)) ||
          (req.query.limit !== undefined && !/^\d+$/.test(req.query.limit)))
        throw fail(400, "Pagina evenimentelor este invalidă.");
      const rows = db.prepare("SELECT * FROM events ORDER BY created DESC,id DESC LIMIT ? OFFSET ?").all(limit + 1, offset);
      const more = rows.length > limit;
      rows.length = Math.min(rows.length, limit);
      res.json({events: rows.map(view), nextOffset: more ? offset + limit : null});
    } catch (error) { next(error); }
  });
  app.post("/api/admin/events", (req, res, next) => {
    try {
      const b = req.body,
        id = randomUUID(),
        token = randomBytes(32).toString("base64url"),
        date = validDate(b.eventDate);
      db.prepare("INSERT INTO events VALUES (?,?,?,?,?,?,?,0,?,?,?)").run(
        id,
        text(b.name, 200, "Denumirea"),
        text(b.location, 300, "Locația"),
        date,
        quota(b.quotaGB),
        maxPhotos(b.maxPhotos ?? null),
        expiration(date, b.retentionDays),
        hash(token),
        seal(token, env.APP_SECRET),
        iso(),
      );
      const e = find(id);
      res.status(201).json({ event: view(e), url: link(e) });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/events/:id", (req, res, next) => {
    try {
      res.json({ event: view(find(req.params.id)) });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/events/:id/link", (req, res, next) => {
    try {
      res.json({ url: link(find(req.params.id)) });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/admin/events/:id/rotate-link", (req, res, next) => {
    try {
      find(req.params.id);
      const t = randomBytes(32).toString("base64url");
      db.prepare(
        "UPDATE events SET token_hash=?,token_sealed=? WHERE id=?",
      ).run(hash(t), seal(t, env.APP_SECRET), req.params.id);
      res.json({ url: link(find(req.params.id)) });
    } catch (e) {
      next(e);
    }
  });
  app.patch("/api/admin/events/:id", (req, res, next) => {
    try {
      const e = find(req.params.id),
        b = req.body,
        c = counts(e.id);
      const q = b.quotaGB === undefined ? e.quota : quota(b.quotaGB),
        m = b.maxPhotos === undefined ? e.max_photos : maxPhotos(b.maxPhotos);
      if (q < c.bytes || (m !== null && m < c.count))
        throw fail(409, "Limita este mai mică decât fotografiile existente.");
      let exp = e.expires;
      if (b.expiresAt !== undefined) {
        if (
          typeof b.expiresAt !== "string" ||
          !Number.isFinite(Date.parse(b.expiresAt)) ||
          !Number.isFinite(new Date(Date.parse(b.expiresAt) + EXPIRY_GRACE_MS).getTime())
        )
          throw fail(400, "Data expirării este invalidă.");
        exp = new Date(b.expiresAt).toISOString();
      }
      if (b.disabled !== undefined && typeof b.disabled !== "boolean")
        throw fail(400, "Starea este invalidă.");
      db.prepare(
        "UPDATE events SET name=?,location=?,quota=?,max_photos=?,expires=?,disabled=? WHERE id=?",
      ).run(
        b.name === undefined ? e.name : text(b.name, 200, "Denumirea"),
        b.location === undefined
          ? e.location
          : text(b.location, 300, "Locația"),
        q,
        m,
        exp,
        b.disabled === undefined ? e.disabled : Number(b.disabled),
        e.id,
      );
      res.json({ event: view(find(e.id)) });
    } catch (e) {
      next(e);
    }
  });
  function listing(eventId, before) {
    let cursor;
    if (before) {
      try {
        cursor = JSON.parse(Buffer.from(before, "base64url").toString());
        if (
          !Array.isArray(cursor) ||
          cursor.length !== 2 ||
          cursor.some((v) => typeof v !== "string")
        )
          throw Error();
      } catch {
        throw fail(400, "Pagina este invalidă.");
      }
    }
    const rows = cursor
      ? db
          .prepare(
            "SELECT * FROM photos WHERE event_id=? AND state='ready' AND (created<? OR (created=? AND id<?)) ORDER BY created DESC,id DESC LIMIT 51",
          )
          .all(eventId, cursor[0], cursor[0], cursor[1])
      : db
          .prepare(
            "SELECT * FROM photos WHERE event_id=? AND state='ready' ORDER BY created DESC,id DESC LIMIT 51",
          )
          .all(eventId);
    const next = rows.length > 50;
    rows.length = Math.min(50, rows.length);
    const last = rows.at(-1);
    return {
      photos: rows.map(photoView),
      nextCursor: next
        ? Buffer.from(JSON.stringify([last.created, last.id])).toString(
            "base64url",
          )
        : null,
    };
  }
  app.get("/api/admin/events/:id/photos", (req, res, next) => {
    try {
      find(req.params.id);
      res.json(listing(req.params.id, req.query.before));
    } catch (e) {
      next(e);
    }
  });
  async function removePhoto(p) {
    db.prepare("UPDATE photos SET state='deleting' WHERE id=?").run(p.id);
    await storage.delete(p.key, p.version);
    db.prepare("DELETE FROM photos WHERE id=?").run(p.id);
  }
  app.delete(
    "/api/admin/events/:id/photos/:photoId",
    requireStorage,
    async (req, res, next) => {
      try {
        const p = db
          .prepare("SELECT * FROM photos WHERE id=? AND event_id=?")
          .get(req.params.photoId, req.params.id);
        if (!p) throw fail(404, "Fotografie negăsită.");
        await removePhoto(p);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.use("/api/album", guest);
  registerDownloads({app, db, storage, requireStorage, now, rate,
    capacity: resourceLimit("MAX_ARCHIVE_CONCURRENCY", 1, 1, 2),
    maxFiles: resourceLimit("MAX_ARCHIVE_FILES", 10000, 1, 50000)});
  app.get("/api/album", (req, res) => {
    const e = view(req.event);
    delete e.id;
    res.json({ event: e });
  });
  app.get("/api/album/photos", (req, res, next) => {
    try {
      res.json(listing(req.event.id, req.query.before));
    } catch (e) {
      next(e);
    }
  });
  const upload = multer({
    dest: tmp,
    limits: { fileSize: maxFileBytes, files: 1, fields: 1, parts: 2, fieldSize: 4000 },
  }).single("photo");
  const activeUploads = new Set();
  let uploadSlots = 0;
  function uploadCapacity(req, res, next) {
    if (uploadSlots >= maxUploadConcurrency)
      return next(
        fail(
          503,
          "Serverul procesează alte fotografii. Reîncercați în câteva secunde.",
        ),
      );
    uploadSlots++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        uploadSlots--;
      }
    };
    req.releaseUpload = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!req.uploadProcessing) release();
    });
    next();
  }
  app.post(
    "/api/album/photos",
    requireStorage,
    uploadCapacity,
    (req, res, next) => {
      try {
        rate(req, "upload", 3000, 3600000);
        next();
      } catch (e) {
        next(e);
      }
    },
    (req, res, next) => {
      upload(req, res, (err) => {
        if (err) {
          req.releaseUpload?.();
          return next(err);
        }
        req.uploadProcessing = true;
        next();
      });
    },
    async (req, res, next) => {
      let p, releaseImage,
        stored = false;
      try {
        if (!req.file) throw fail(400, "Selectați o fotografie.");
        if (Object.keys(req.body || {}).some(key => key !== "description") ||
            (req.body?.description !== undefined && typeof req.body.description !== "string"))
          throw fail(400, "Descrierea fotografiei este invalidă.");
        const description = (req.body?.description || "").trim();
        if (description.length > 500)
          throw fail(400, "Descrierea poate avea cel mult 500 de caractere.");
        releaseImage = acquireImage();
        const metadata = await sharp(req.file.path, {
          limitInputPixels: maxImagePixels,
          failOn: "warning",
        }).metadata();
        if (
          !["jpeg", "png", "webp"].includes(metadata.format) ||
          metadata.pages > 1
        )
          throw fail(
            400,
            "Folosiți fotografii JPEG, PNG sau WebP fără animație.",
          );
        await sharp(req.file.path, {
          limitInputPixels: maxImagePixels,
          failOn: "warning",
        })
          .resize(1, 1)
          .raw()
          .toBuffer();
        releaseImage();
        releaseImage = null;
        const id = randomUUID(),
          bytes = (await stat(req.file.path)).size,
          ext = { jpeg: "jpg", png: "png", webp: "webp" }[metadata.format];
        p = {
          id,
          event_id: req.event.id,
          description,
          name:
            path
              .basename(req.file.originalname)
              .replace(/[\u0000-\u001f\u007f]/g, "")
              .slice(0, 200) || "fotografie." + ext,
          bytes,
          key: `qr-forever/${req.event.id}/${id}.${ext}`,
          type: `image/${metadata.format}`,
          created: iso(),
          version: null,
        };
        db.exec("BEGIN IMMEDIATE");
        try {
          const e = find(req.event.id),
            c = counts(e.id);
          if (
            e.disabled ||
            e.expires <= iso() ||
            e.token_hash !== req.event.token_hash
          )
            throw fail(404, "Album indisponibil sau expirat.");
          if (
            c.bytes + bytes > e.quota ||
            (e.max_photos !== null && c.count >= e.max_photos)
          )
            throw fail(409, "Limita albumului a fost atinsă.");
          db.prepare(
            "INSERT INTO photos (id,event_id,name,bytes,key,version,type,state,created,description) VALUES (?,?,?,?,?,?,?,'pending',?,?)",
          ).run(
            p.id,
            p.event_id,
            p.name,
            p.bytes,
            p.key,
            null,
            p.type,
            p.created,
            p.description,
          );
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          p = null;
          throw e;
        }
        activeUploads.add(id);
        const result = await storage.put(p.key, req.file.path, p.type);
        p.version = result.versionId;
        stored = true;
        db.prepare("UPDATE photos SET version=? WHERE id=?").run(
          p.version,
          p.id,
        );
        const current = find(p.event_id);
        if (
          current.disabled ||
          current.expires <= iso() ||
          current.token_hash !== req.event.token_hash
        )
          throw fail(404, "Album indisponibil sau expirat.");
        db.prepare("UPDATE photos SET state='ready' WHERE id=?").run(id);
        res.status(201).json({ photo: photoView(p) });
      } catch (e) {
        if (p) {
          try {
            await removePhoto(p);
          } catch {
            db.prepare("UPDATE photos SET state='deleting' WHERE id=?").run(
              p.id,
            );
          }
        }
        next(
          e.status
            ? e
            : fail(
                p ? 503 : 400,
                p
                  ? "Stocarea nu a finalizat încărcarea. Reîncercați."
                  : "Fotografia nu a putut fi încărcată.",
              ),
        );
      } finally {
        releaseImage?.();
        req.releaseUpload?.();
        if (p) activeUploads.delete(p.id);
        if (req.file) await unlink(req.file.path).catch(() => {});
      }
    },
  );
  async function content(req, res, next, eventId) {
    try {
      const p = db
        .prepare(
          "SELECT * FROM photos WHERE id=? AND event_id=? AND state='ready'",
        )
        .get(req.params.id, eventId);
      if (!p) throw fail(404, "Fotografie negăsită.");
      const object = await storage.get(p.key, p.version);
      res.set({
        "Content-Type": p.type,
        "Content-Disposition": `${req.query.download === "1" ? "attachment" : "inline"}; filename="photo-${p.id}.${p.type === "image/jpeg" ? "jpg" : p.type.split("/")[1]}"`,
        "Content-Length": String(p.bytes),
        "Cache-Control": "private, no-store",
      });
      await pipeline(object.body, res);
    } catch (e) {
      if (res.headersSent) res.destroy();
      else next(e);
    }
  }
  app.get("/api/album/photos/:id/content", requireStorage, (req, res, next) =>
    content(req, res, next, req.event.id),
  );
  app.get(
    "/api/admin/events/:eventId/photos/:id/content",
    requireStorage,
    (req, res, next) => content(req, res, next, req.params.eventId),
  );
  let thumbnailSlots = 0;
  async function thumbnail(req, res, next, eventId) {
    let file, releaseImage;
    try {
      rate(req, "thumbnail", 10000, 3600000);
      if (thumbnailSlots >= maxThumbnailConcurrency)
        throw fail(429, "Prea multe previzualizări simultane. Reîncercați.");
      const p = db
        .prepare(
          "SELECT * FROM photos WHERE id=? AND event_id=? AND state='ready'",
        )
        .get(req.params.id, eventId);
      if (!p) throw fail(404, "Fotografie negăsită.");
      thumbnailSlots++;
      file = path.join(tmp, "thumb-" + randomUUID());
      const object = await storage.get(p.key, p.version);
      let bytes = 0;
      const limit = new Transform({
        transform(chunk, encoding, done) {
          bytes += chunk.length;
          done(bytes > maxFileBytes ? new Error("Object too large") : null, chunk);
        },
      });
      await pipeline(
        object.body,
        limit,
        createWriteStream(file, { flags: "wx", mode: 0o600 }),
      );
      releaseImage = acquireImage();
      const small = await sharp(file, {
        limitInputPixels: maxImagePixels,
        failOn: "warning",
      })
        .rotate()
        .resize({
          width: 600,
          height: 600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75 })
        .toBuffer();
      releaseImage();
      releaseImage = null;
      res
        .set({
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, no-store",
        })
        .send(small);
    } catch (e) {
      next(e);
    } finally {
      releaseImage?.();
      if (file) {
        thumbnailSlots--;
        await unlink(file).catch(() => {});
      }
    }
  }
  app.get("/api/album/photos/:id/thumbnail", requireStorage, (req, res, next) =>
    thumbnail(req, res, next, req.event.id),
  );
  app.get(
    "/api/admin/events/:eventId/photos/:id/thumbnail",
    requireStorage,
    (req, res, next) => thumbnail(req, res, next, req.params.eventId),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Ruta nu există." }),
  );
  app.get("/js/config.js", (req, res) =>
    res
      .type("js")
      .send(
        'window.QR_FOREVER=Object.freeze({API_BASE:"",PHOTO_STORAGE_ENABLED:true,REAL_ADMIN:true});',
      ),
  );
  app.use(express.static(path.join(here, "public"), { index: false }));
  app.get(["/", "/index.html"], async (req, res, next) => {
    try {
      const html = await readFile(
        path.join(here, "../docs/index.html"),
        "utf8",
      );
      res
        .type("html")
        .send(
          html.replace(
            "Încărcarea fotografiilor nu este disponibilă încă.",
            "Invitații încarcă fotografii în albumul activat de administrator.",
          ),
        );
    } catch (e) {
      next(e);
    }
  });
  app.use(express.static(path.join(here, "../docs")));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status =
      err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err instanceof multer.MulterError
          ? 400
          : err.status || 500;
    res
      .status(status)
      .json({
        error:
          status === 500
            ? "Eroare internă. Reîncercați."
            : err.code === "LIMIT_FILE_SIZE"
              ? "Fișierul depășește 200 MB."
              : err.message,
      });
  });
  async function cleanup({ startup = false } = {}) {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      if (!(await verifyStorage())) return;
      const pending = db
        .prepare(
          "SELECT p.* FROM photos p JOIN events e ON e.id=p.event_id WHERE p.state='deleting' OR e.expires<=? OR (p.state='pending' AND p.created<?)",
        )
        .all(
          new Date(now() - EXPIRY_GRACE_MS).toISOString(),
          new Date(now() - (startup ? -1 : 2 * 3600000)).toISOString(),
        );
      for (const p of pending) {
        if (activeUploads.has(p.id)) continue;
        const current = db
          .prepare(
            "SELECT p.*,e.expires FROM photos p JOIN events e ON e.id=p.event_id WHERE p.id=?",
          )
          .get(p.id);
        if (!current) continue;
        const stalePending =
          current.state === "pending" &&
          current.created <
            new Date(now() - (startup ? -1 : 2 * 3600000)).toISOString();
        if (
          current.state !== "deleting" &&
          Date.parse(current.expires) + EXPIRY_GRACE_MS > now() &&
          !stalePending
        )
          continue;
        try {
          await removePhoto(current);
        } catch {
          /* Persistent deleting row is retried on next sweep. */
        }
      }
      db.prepare("DELETE FROM sessions WHERE expires<?").run(now());
      for (const name of await readdir(tmp)) {
        const file = path.join(tmp, name);
        if ((await stat(file)).mtimeMs < now() - 24 * 3600000)
          await unlink(file).catch(() => {});
      }
    } finally {
      cleanupRunning = false;
    }
  }
  await cleanup({ startup: true });
  const timer = setInterval(() => cleanup().catch(() => {}), 3600000);
  timer.unref();
  return {
    app,
    db,
    cleanup,
    close() {
      clearInterval(timer);
      db.close();
    },
    verifyStorage,
  };
}
