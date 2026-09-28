import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';
import { hash } from './security.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const unavailable = () => fail(404, 'Descărcare indisponibilă sau expirată.');
export function registerDownloads({ app, db, storage, requireStorage, now, rate, capacity, maxFiles }) {
  db.exec(`CREATE TABLE IF NOT EXISTS download_tickets (
    hash TEXT PRIMARY KEY,event_id TEXT NOT NULL,token_hash TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS download_items (
    ticket_hash TEXT NOT NULL REFERENCES download_tickets(hash) ON DELETE CASCADE,
    photo_id TEXT NOT NULL,PRIMARY KEY(ticket_hash,photo_id));`);
  let active = 0;
  app.post('/api/album/download-ticket', requireStorage, (req, res, next) => {
    try {
      rate(req, 'archive', 15, 60000);
      if (active >= capacity) { res.set('Retry-After', '10'); throw fail(503, 'O altă arhivă este în curs. Reîncercați în câteva secunde.'); }
      const ids = req.body?.photoIds;
      if (ids !== null && (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000 ||
          ids.some(id => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) || new Set(ids).size !== ids.length))
        throw fail(400, 'Selectați între 1 și 1000 de fotografii sau întregul album.');
      db.prepare('DELETE FROM download_tickets WHERE expires<=?').run(now());
      const countRequested = ids === null
        ? db.prepare("SELECT COUNT(*) n FROM photos WHERE event_id=? AND state='ready'").get(req.event.id).n
        : ids.length;
      if (countRequested > maxFiles) throw fail(413,
        `O arhivă poate conține cel mult ${maxFiles} de fotografii. Selectați un grup mai mic și descărcați pe rând.`);
      if (db.prepare('SELECT COUNT(*) n FROM download_tickets WHERE event_id=?').get(req.event.id).n >= 5)
        throw fail(429, 'Există deja câteva descărcări pregătite. Așteptați două minute și reîncercați.');
      const token = randomBytes(32).toString('base64url'), ticketHash = hash(token);
      db.exec('BEGIN IMMEDIATE');
      let count;
      try {
        db.prepare('INSERT INTO download_tickets VALUES (?,?,?,?)')
          .run(ticketHash, req.event.id, req.event.token_hash, now() + 120000);
        if (ids === null) {
          db.prepare("INSERT INTO download_items SELECT ?,id FROM photos WHERE event_id=? AND state='ready'")
            .run(ticketHash, req.event.id);
        } else {
          const check = db.prepare("SELECT id FROM photos WHERE id=? AND event_id=? AND state='ready'");
          const add = db.prepare('INSERT INTO download_items VALUES (?,?)');
          for (const id of ids) {
            if (!check.get(id, req.event.id)) throw unavailable();
            add.run(ticketHash, id);
          }
        }
        count = db.prepare('SELECT COUNT(*) n FROM download_items WHERE ticket_hash=?').get(ticketHash).n;
        if (!count) throw fail(400, 'Albumul nu conține fotografii.');
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      res.json({downloadUrl: '/api/downloads/' + token, expiresIn: 120, photoCount: count});
    } catch (error) { next(error); }
  });
  app.get('/api/downloads/:token', requireStorage, async (req, res, next) => {
    let acquired = false, zip, source, stopped = false;
    const controller = new AbortController();
    const stop = () => { stopped = true; controller.abort(); source?.destroy(); zip?.outputStream.destroy(); };
    try {
      if (req.method !== 'GET' || !/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) throw unavailable();
      const ticketHash = hash(req.params.token);
      const ticket = db.prepare(`SELECT t.*,e.disabled,e.expires event_expires,e.token_hash current_hash
        FROM download_tickets t JOIN events e ON e.id=t.event_id WHERE t.hash=?`).get(ticketHash);
      if (!ticket || ticket.expires <= now() || ticket.disabled || ticket.event_expires <= new Date(now()).toISOString() ||
          ticket.current_hash !== ticket.token_hash) throw unavailable();
      if (active >= capacity) { res.set('Retry-After', '10'); throw fail(503, 'O altă arhivă este în curs. Reîncercați în câteva secunde.'); }
      const expected = db.prepare('SELECT COUNT(*) n FROM download_items WHERE ticket_hash=?').get(ticketHash).n;
      const actual = db.prepare(`SELECT COUNT(*) n FROM download_items i JOIN photos p ON p.id=i.photo_id
        WHERE i.ticket_hash=? AND p.event_id=? AND p.state='ready'`).get(ticketHash, ticket.event_id).n;
      if (!expected || actual !== expected) throw unavailable();
      active++; acquired = true;
      zip = new ZipFile();
      zip.on('error', error => { source?.destroy(); zip.outputStream.destroy(error); });
      res.once('close', stop);
      let sequence = 0;
      for (const photo of db.prepare(`SELECT p.* FROM download_items i JOIN photos p ON p.id=i.photo_id
        WHERE i.ticket_hash=? AND p.event_id=? AND p.state='ready' ORDER BY p.created,p.id`).iterate(ticketHash, ticket.event_id)) {
        const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[photo.type] || 'image';
        zip.addReadStreamLazy(`photo-${String(++sequence).padStart(4,'0')}.${ext}`,
          {compress:false,size:photo.bytes,mtime:new Date(photo.created)}, callback => {
            if (stopped) return callback(new Error('Download cancelled'));
            const event = db.prepare('SELECT disabled,expires,token_hash FROM events WHERE id=?').get(ticket.event_id);
            if (!event || event.disabled || event.expires <= new Date(now()).toISOString() || event.token_hash !== ticket.token_hash)
              return callback(unavailable());
            if (!db.prepare("SELECT id FROM photos WHERE id=? AND event_id=? AND state='ready'").get(photo.id, ticket.event_id))
              return callback(unavailable());
            storage.get(photo.key, photo.version, {signal:controller.signal}).then(object => {
              if (stopped) { object.body.destroy(); return; }
              source = object.body;
              source.once('error', error => zip.emit('error', error));
              callback(null, source);
            }, callback);
          });
      }
      // Consume only after validation and acquiring capacity; no credentials enter the archive.
      db.prepare('DELETE FROM download_tickets WHERE hash=?').run(ticketHash);
      res.set({'Content-Type':'application/zip','Content-Disposition':'attachment; filename="album-photos.zip"',
        'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Accel-Buffering':'no'});
      const transfer = pipeline(zip.outputStream, res);
      zip.end();
      await transfer;
    } catch (error) {
      stop();
      if (!res.headersSent && !res.destroyed) {
        const safe = error.status ? error : fail(502, 'Descărcarea nu a putut fi finalizată.');
        res.status(safe.status).type('text/plain').send(safe.message + ' Reveniți la album pentru o nouă descărcare.');
      }
      else if (!res.destroyed) res.destroy(error);
    } finally {
      res.off('close', stop);
      if (acquired) active--;
    }
  });
}
