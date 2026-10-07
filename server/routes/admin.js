import { Router } from 'express';
import { all, one, db, exec, bump } from '../db.js';
import { requireUser, requireRole } from '../auth.js';
import { hashSecret } from '../security.js';
import * as v from '../validate.js';
import { HttpError } from '../validate.js';

const r = Router();
r.use(requireUser, requireRole('admin'));

const dist = async (sql) => Object.fromEntries((await all(sql)).map((x) => [x.k, x.n]));

r.get('/metrics', async (req, res) => {
  const count = async (sql) => (await one(sql)).n;
  const active = await one(`SELECT * FROM rides WHERE status = 'active' ORDER BY id DESC LIMIT 1`);
  const aid = active?.id ?? -1;
  const [totalRides, endedRides, totalPickups, verified, dropped, quit, activePickups] = await Promise.all([
    count(`SELECT COUNT(*) n FROM rides`),
    count(`SELECT COUNT(*) n FROM rides WHERE status = 'ended'`),
    count(`SELECT COUNT(*) n FROM pickups`),
    count(`SELECT COUNT(*) n FROM pickups WHERE verified = 1`),
    count(`SELECT COUNT(*) n FROM pickups WHERE status = 'dropped'`),
    count(`SELECT COUNT(*) n FROM pickups WHERE status = 'quit'`),
    count(`SELECT COUNT(*) n FROM pickups WHERE status = 'active'`),
  ]);
  const inRide = (role, extra = '') =>
    one(`SELECT COUNT(*) n FROM ride_members WHERE ride_id = ? AND role = ? ${extra}`, [aid, role]).then((x) => x.n);
  const passengersMatched = await count(`SELECT COUNT(*) n FROM pickups WHERE status = 'active' AND ride_id = ${aid}`);
  const passengersInRide = await inRide('passenger');
  res.json({
    rides: {
      total: totalRides,
      ended: endedRides,
      active: active ? { id: active.id, name: active.name } : null,
      ridersJoined: await inRide('rider'),
      ridersVisible: await inRide('rider', 'AND visible = 1'),
      passengersJoined: passengersInRide,
      passengersWaiting: Math.max(0, passengersInRide - passengersMatched),
      activePickups,
      totalPickups,
      verifiedPickups: verified,
      droppedPickups: dropped,
      quitPickups: quit,
    },
    passengers: {
      total: await count(`SELECT COUNT(*) n FROM passenger_profiles`),
      firstTimers: await count(`SELECT COUNT(*) n FROM passenger_profiles WHERE first_time = 1`),
      avgExperience: (await one(`SELECT ROUND(AVG(experience), 1) n FROM passenger_profiles`)).n,
      helmetSizes: await dist(`SELECT helmet_size k, COUNT(*) n FROM passenger_profiles GROUP BY helmet_size`),
      experience: await dist(`SELECT experience k, COUNT(*) n FROM passenger_profiles GROUP BY experience`),
    },
    riders: {
      total: await count(`SELECT COUNT(*) n FROM rider_profiles`),
      takingPassengers: await count(`SELECT COUNT(*) n FROM rider_profiles WHERE takes_passengers = 1`),
      spareHelmet: await count(`SELECT COUNT(*) n FROM rider_profiles WHERE spare_helmet = 1`),
      bikeTypes: await dist(`SELECT bike_type k, COUNT(*) n FROM rider_profiles GROUP BY bike_type`),
    },
  });
});

r.get('/users', async (req, res) => {
  const rows = await all(`SELECT id, username, role, created_at FROM users ORDER BY role, username`);
  res.json({ users: rows.map((u) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.created_at })) });
});

async function target(req) {
  const u = await one('SELECT * FROM users WHERE id = ?', [Number(req.params.id)]);
  if (!u) throw new HttpError(404, 'User not found');
  return u;
}

r.delete('/users/:id', async (req, res) => {
  const u = await target(req);
  if (u.id === req.user.id) throw new HttpError(400, 'You cannot remove your own account');
  await db.batch(
    [
      { sql: 'DELETE FROM pickups WHERE rider_id = ? OR passenger_id = ?', args: [u.id, u.id] },
      { sql: 'DELETE FROM ride_members WHERE user_id = ?', args: [u.id] },
      { sql: 'DELETE FROM rider_profiles WHERE user_id = ?', args: [u.id] },
      { sql: 'DELETE FROM passenger_profiles WHERE user_id = ?', args: [u.id] },
      { sql: 'DELETE FROM users WHERE id = ?', args: [u.id] },
    ],
    'write',
  );
  await bump();
  res.json({ ok: true });
});

r.post('/users/:id/reset', async (req, res) => {
  const u = await target(req);
  const secret = u.role === 'admin' ? v.password(req.body?.secret) : v.pin(req.body?.secret);
  // bumping token_version signs the user out of any existing session
  await exec('UPDATE users SET secret_hash = ?, failed_attempts = 0, locked_until = 0, token_version = token_version + 1 WHERE id = ?', [await hashSecret(secret), u.id]);
  res.json({ ok: true });
});

r.post('/admins', async (req, res) => {
  const name = v.username(req.body?.username);
  const pw = v.password(req.body?.password);
  try {
    await exec(`INSERT INTO users (username, secret_hash, role, created_at) VALUES (?, ?, 'admin', ?)`, [name, await hashSecret(pw), Date.now()]);
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, 'That username is taken');
    throw e;
  }
  await bump();
  res.json({ ok: true });
});

r.get('/rides', async (req, res) => {
  const rows = await all(`
    SELECT r.*,
      (SELECT COUNT(*) FROM ride_members m WHERE m.ride_id = r.id AND m.role = 'rider') riders,
      (SELECT COUNT(*) FROM ride_members m WHERE m.ride_id = r.id AND m.role = 'passenger') passengers,
      (SELECT COUNT(*) FROM pickups p WHERE p.ride_id = r.id) pickups
    FROM rides r ORDER BY r.id DESC LIMIT 50`);
  res.json({
    rides: rows.map((x) => ({ id: x.id, name: x.name, description: x.description, startsAt: x.starts_at, status: x.status, riders: x.riders, passengers: x.passengers, pickups: x.pickups, createdAt: x.created_at })),
  });
});

r.post('/rides', async (req, res) => {
  const input = v.rideInput(req.body);
  if (await one(`SELECT id FROM rides WHERE status = 'active'`)) throw new HttpError(409, 'End the current ride before creating a new one');
  await exec('INSERT INTO rides (name, description, starts_at, created_by, created_at) VALUES (?, ?, ?, ?, ?)', [input.name, input.description, input.starts_at, req.user.id, Date.now()]);
  await bump();
  res.json({ ok: true });
});

r.post('/rides/:id/end', async (req, res) => {
  const id = Number(req.params.id);
  const ride = await one('SELECT * FROM rides WHERE id = ?', [id]);
  if (!ride) throw new HttpError(404, 'Ride not found');
  await db.batch(
    [
      { sql: `UPDATE rides SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'active'`, args: [Date.now(), id] },
      { sql: `UPDATE pickups SET status = 'ended', ended_at = ? WHERE ride_id = ? AND status = 'active'`, args: [Date.now(), id] },
    ],
    'write',
  );
  await bump();
  res.json({ ok: true });
});

export default r;
