import { Router } from 'express';
import { db, one, exec, bump, getVersion } from '../db.js';
import { requireUser, requireRole } from '../auth.js';
import { buildState, currentRide, getProfile } from '../state.js';
import { encrypt, decrypt, randomPin } from '../security.js';
import * as v from '../validate.js';
import { HttpError } from '../validate.js';

const r = Router();
r.use(requireUser);

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const activeRide = async () => {
  const ride = await currentRide();
  if (!ride || ride.status !== 'active') throw new HttpError(409, 'There is no active ride');
  return ride;
};
const memberOf = (rideId, userId) =>
  one('SELECT * FROM ride_members WHERE ride_id = ? AND user_id = ?', [rideId, userId]);

r.get('/state', async (req, res) => res.json(await buildState(req.user)));

// Server-sent events. A serverless function can't hold a connection forever, so the
// stream lives ~25s and EventSource reconnects automatically. Works on Vercel and Node.
r.get('/events', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  res.flushHeaders();
  let closed = false;
  req.on('close', () => (closed = true));
  res.write('retry: 1000\n');
  let last = await getVersion();
  res.write(`data: ${last}\n\n`);
  const end = Date.now() + 25000;
  while (!closed && Date.now() < end) {
    await sleep(1000);
    try {
      const now = await getVersion();
      if (now !== last) {
        last = now;
        res.write(`data: ${now}\n\n`);
      } else res.write(': ping\n\n');
    } catch {
      break;
    }
  }
  res.end();
});

r.put('/profile', requireRole('rider', 'passenger'), async (req, res) => {
  const u = req.user;
  if (u.role === 'rider') {
    const p = v.riderProfile(req.body);
    await exec(
      `UPDATE rider_profiles SET make=?, model=?, displacement=?, bike_type=?, spare_helmet=?, takes_passengers=? WHERE user_id=?`,
      [p.make, p.model, p.displacement, p.bike_type, p.spare_helmet, p.takes_passengers, u.id],
    );
    // a rider who stops taking passengers is no longer visible
    if (!p.takes_passengers) await exec(`UPDATE ride_members SET visible = 0 WHERE user_id = ?`, [u.id]);
  } else {
    const p = v.passengerProfile(req.body);
    await exec(`UPDATE passenger_profiles SET helmet_size=?, first_time=?, experience=? WHERE user_id=?`, [p.helmet_size, p.first_time, p.experience, u.id]);
  }
  await bump();
  res.json({ profile: await getProfile(u) });
});

r.post('/ride/join', requireRole('rider', 'passenger'), async (req, res) => {
  const ride = await activeRide();
  await exec(`INSERT OR IGNORE INTO ride_members (ride_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [ride.id, req.user.id, req.user.role, Date.now()]);
  await bump();
  res.json({ ok: true });
});

r.post('/ride/leave', requireRole('rider', 'passenger'), async (req, res) => {
  const ride = await currentRide();
  if (ride) {
    await db.batch(
      [
        { sql: `UPDATE pickups SET status = 'ended', ended_at = ? WHERE status = 'active' AND (rider_id = ? OR passenger_id = ?)`, args: [Date.now(), req.user.id, req.user.id] },
        { sql: `DELETE FROM ride_members WHERE ride_id = ? AND user_id = ?`, args: [ride.id, req.user.id] },
      ],
      'write',
    );
    await bump();
  }
  res.json({ ok: true });
});

// ---- rider ----
r.post('/rider/visibility', requireRole('rider'), async (req, res) => {
  const ride = await activeRide();
  if (!(await memberOf(ride.id, req.user.id))) throw new HttpError(409, 'Join the ride first');
  const visible = req.body?.visible === true;
  if (visible) {
    const p = await getProfile(req.user);
    if (!p.takesPassengers) throw new HttpError(400, 'Enable "willing to take passengers" in Settings first');
  }
  await exec('UPDATE ride_members SET visible = ? WHERE ride_id = ? AND user_id = ?', [visible ? 1 : 0, ride.id, req.user.id]);
  await bump();
  res.json({ ok: true });
});

r.post('/rider/pickup', requireRole('rider'), async (req, res) => {
  const ride = await activeRide();
  const me = await memberOf(ride.id, req.user.id);
  if (!me) throw new HttpError(409, 'Join the ride first');
  if (!me.visible) throw new HttpError(409, 'Make yourself visible before picking up a passenger');
  const passengerId = Number(req.body?.passengerId);
  if (!(await memberOf(ride.id, passengerId)) || (await one('SELECT role FROM users WHERE id = ?', [passengerId]))?.role !== 'passenger')
    throw new HttpError(404, 'Passenger is no longer on this ride');
  try {
    await exec(
      `INSERT INTO pickups (ride_id, rider_id, passenger_id, code_enc, created_at) VALUES (?, ?, ?, ?, ?)`,
      [ride.id, req.user.id, passengerId, encrypt(randomPin()), Date.now()],
    );
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, 'That passenger was just taken, or you already have a passenger');
    throw e;
  }
  await bump();
  res.json({ ok: true });
});

r.post('/rider/drop', requireRole('rider'), async (req, res) => {
  const rs = await exec(`UPDATE pickups SET status = 'dropped', ended_at = ? WHERE rider_id = ? AND status = 'active'`, [Date.now(), req.user.id]);
  if (!rs.rowsAffected) throw new HttpError(404, 'No active passenger');
  await bump();
  res.json({ ok: true });
});

// ---- passenger ----
r.post('/passenger/verify', requireRole('passenger'), async (req, res) => {
  const code = req.body?.code;
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) throw new HttpError(400, 'Enter the 4 digit code');
  const pk = await one(`SELECT * FROM pickups WHERE passenger_id = ? AND status = 'active'`, [req.user.id]);
  if (!pk) throw new HttpError(404, 'You have no active pickup');
  if (pk.verified) return res.json({ ok: true });
  if (pk.code_attempts >= 5) throw new HttpError(429, 'Too many wrong codes. Ask your rider to drop you and pick you up again.');
  await exec('UPDATE pickups SET code_attempts = code_attempts + 1 WHERE id = ?', [pk.id]);
  if (decrypt(pk.code_enc) !== code) {
    await bump();
    throw new HttpError(400, 'That code is not correct');
  }
  await exec('UPDATE pickups SET verified = 1 WHERE id = ?', [pk.id]);
  await bump();
  res.json({ ok: true });
});

r.post('/passenger/quit', requireRole('passenger'), async (req, res) => {
  const rs = await exec(`UPDATE pickups SET status = 'quit', ended_at = ? WHERE passenger_id = ? AND status = 'active'`, [Date.now(), req.user.id]);
  if (!rs.rowsAffected) throw new HttpError(404, 'You have no active pickup');
  await bump();
  res.json({ ok: true });
});

export default r;
