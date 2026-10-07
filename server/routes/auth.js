import { Router } from 'express';
import { all, one, db, bump } from '../db.js';
import { COOKIE, cookieOptions, requireUser } from '../auth.js';
import { checkSecret, hashSecret, signToken } from '../security.js';
import * as v from '../validate.js';
import { HttpError } from '../validate.js';

const r = Router();
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
// used to keep response time similar for unknown usernames
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4VYfzK1v1KkKq1m0yQz0n7s0o0eG';

r.post('/register', async (req, res) => {
  const { role, profile } = req.body || {};
  if (role !== 'rider' && role !== 'passenger') throw new HttpError(400, 'Choose rider or passenger');
  const name = v.username(req.body.username);
  const pin = v.pin(req.body.pin);
  const p = role === 'rider' ? v.riderProfile(profile) : v.passengerProfile(profile);
  const hash = await hashSecret(pin);
  const idOf = '(SELECT id FROM users WHERE username = ?)';
  try {
    await db.batch(
      [
        { sql: `INSERT INTO users (username, secret_hash, role, created_at) VALUES (?, ?, ?, ?)`, args: [name, hash, role, Date.now()] },
        role === 'rider'
          ? { sql: `INSERT INTO rider_profiles VALUES (${idOf}, ?, ?, ?, ?, ?, ?)`, args: [name, p.make, p.model, p.displacement, p.bike_type, p.spare_helmet, p.takes_passengers] }
          : { sql: `INSERT INTO passenger_profiles VALUES (${idOf}, ?, ?, ?)`, args: [name, p.helmet_size, p.first_time, p.experience] },
      ],
      'write',
    );
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, 'That username is taken');
    throw e;
  }
  const user = await one('SELECT * FROM users WHERE username = ?', [name]);
  res.cookie(COOKIE, signToken(user), cookieOptions());
  await bump();
  res.json({ ok: true });
});

r.post('/login', async (req, res) => {
  const { username, pin } = req.body || {};
  if (typeof username !== 'string' || typeof pin !== 'string') throw new HttpError(400, 'Username and PIN required');
  const user = await one('SELECT * FROM users WHERE username = ?', [username.trim()]);
  const now = Date.now();
  if (user && user.locked_until > now) {
    throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil((user.locked_until - now) / 60000)} min.`);
  }
  const ok = await checkSecret(pin, user ? user.secret_hash : DUMMY_HASH);
  if (!user || !ok) {
    if (user) {
      const fails = user.failed_attempts + 1;
      await db.execute({
        sql: 'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
        args: [fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now + LOCK_MS : 0, user.id],
      });
    }
    throw new HttpError(401, 'Incorrect username or PIN');
  }
  await db.execute({ sql: 'UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?', args: [user.id] });
  res.cookie(COOKIE, signToken(user), cookieOptions());
  res.json({ ok: true });
});

r.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

export default r;
