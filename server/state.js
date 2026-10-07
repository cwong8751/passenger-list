import { all, one } from './db.js';
import { decrypt } from './security.js';

export async function currentRide() {
  return (
    (await one(`SELECT * FROM rides WHERE status = 'active' ORDER BY id DESC LIMIT 1`)) ||
    (await one(`SELECT * FROM rides ORDER BY id DESC LIMIT 1`))
  );
}

const riderPublic = (r) => ({
  id: r.user_id ?? r.id,
  username: r.username,
  make: r.make,
  model: r.model,
  displacement: r.displacement,
  bikeType: r.bike_type,
  spareHelmet: !!r.spare_helmet,
  takesPassengers: !!r.takes_passengers,
});
const passengerPublic = (r) => ({
  id: r.user_id ?? r.id,
  username: r.username,
  helmetSize: r.helmet_size,
  firstTime: !!r.first_time,
  experience: r.experience,
});

export async function getProfile(user) {
  if (user.role === 'rider')
    return riderPublic(await one(`SELECT p.*, u.username FROM rider_profiles p JOIN users u ON u.id = p.user_id WHERE user_id = ?`, [user.id]));
  if (user.role === 'passenger')
    return passengerPublic(await one(`SELECT p.*, u.username FROM passenger_profiles p JOIN users u ON u.id = p.user_id WHERE user_id = ?`, [user.id]));
  return null;
}

// Everything a rider / passenger screen needs, in one payload.
export async function buildState(user) {
  const out = {
    user: { id: user.id, username: user.username, role: user.role },
    profile: await getProfile(user),
    ride: null,
    joined: false,
  };
  if (user.role === 'admin') return out;
  const ride = await currentRide();
  if (!ride) return out;
  out.ride = { id: ride.id, name: ride.name, description: ride.description, startsAt: ride.starts_at, status: ride.status };
  const member = await one('SELECT * FROM ride_members WHERE ride_id = ? AND user_id = ?', [ride.id, user.id]);
  if (!member) return out;
  out.joined = true;
  if (ride.status !== 'active') return out;

  if (user.role === 'rider') {
    out.visible = !!member.visible;
    const pk = await one(`SELECT * FROM pickups WHERE rider_id = ? AND status = 'active'`, [user.id]);
    if (pk) {
      const p = await one(
        `SELECT p.*, u.username FROM passenger_profiles p JOIN users u ON u.id = p.user_id WHERE user_id = ?`,
        [pk.passenger_id],
      );
      out.pickup = { id: pk.id, code: decrypt(pk.code_enc), verified: !!pk.verified, passenger: passengerPublic(p) };
    } else {
      const rows = await all(
        `SELECT p.*, u.username FROM ride_members m
           JOIN users u ON u.id = m.user_id
           JOIN passenger_profiles p ON p.user_id = u.id
          WHERE m.ride_id = ? AND m.role = 'passenger'
            AND NOT EXISTS (SELECT 1 FROM pickups k WHERE k.passenger_id = u.id AND k.status = 'active')
          ORDER BY m.joined_at`,
        [ride.id],
      );
      out.passengers = rows.map(passengerPublic);
    }
  } else {
    const pk = await one(`SELECT * FROM pickups WHERE passenger_id = ? AND status = 'active'`, [user.id]);
    if (pk) {
      const r = await one(
        `SELECT p.*, u.username FROM rider_profiles p JOIN users u ON u.id = p.user_id WHERE user_id = ?`,
        [pk.rider_id],
      );
      out.pickup = { id: pk.id, verified: !!pk.verified, attemptsLeft: Math.max(0, 5 - pk.code_attempts), rider: riderPublic(r) };
    } else {
      const c = await one(`SELECT COUNT(*) AS n FROM ride_members WHERE ride_id = ? AND role = 'rider' AND visible = 1`, [ride.id]);
      out.ridersAvailable = c.n;
    }
  }
  return out;
}
