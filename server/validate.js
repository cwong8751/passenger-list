export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (m) => new HttpError(400, m);

export const BIKE_TYPES = ['cruiser', 'sport', 'adventure', 'touring', 'naked', 'dual-sport', 'standard', 'scooter', 'other'];
export const HELMET_SIZES = ['s', 'm', 'l', 'xl', 'idk'];

export function username(v) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_.-]{3,24}$/.test(v.trim()))
    throw bad('Username must be 3-24 characters: letters, numbers, . _ -');
  return v.trim();
}
export function pin(v) {
  if (typeof v !== 'string' || !/^\d{4}$/.test(v)) throw bad('PIN must be exactly 4 digits');
  return v;
}
export function password(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 100) throw bad('Password must be 8-100 characters');
  return v;
}
const str = (v, label, max = 40) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw bad(`${label} is required (max ${max} characters)`);
  return v.trim();
};
const bool = (v, label) => {
  if (typeof v !== 'boolean') throw bad(`${label} must be yes or no`);
  return v ? 1 : 0;
};

export function riderProfile(p = {}) {
  const displacement = Number(p.displacement);
  if (!Number.isInteger(displacement) || displacement < 1 || displacement > 3000)
    throw bad('Displacement must be a whole number of cc (1-3000)');
  if (!BIKE_TYPES.includes(p.bikeType)) throw bad('Choose a motorcycle type');
  return {
    make: str(p.make, 'Motorcycle make'),
    model: str(p.model, 'Motorcycle model'),
    displacement,
    bike_type: p.bikeType,
    spare_helmet: bool(p.spareHelmet, 'Spare helmet'),
    takes_passengers: bool(p.takesPassengers, 'Willing to take passengers'),
  };
}
export function passengerProfile(p = {}) {
  const experience = Number(p.experience);
  if (!HELMET_SIZES.includes(p.helmetSize)) throw bad('Choose a helmet size');
  if (!Number.isInteger(experience) || experience < 1 || experience > 5) throw bad('Experience must be 1-5');
  return { helmet_size: p.helmetSize, first_time: bool(p.firstTime, 'First time'), experience };
}
export function rideInput(b = {}) {
  return {
    name: str(b.name, 'Ride name', 80),
    description: typeof b.description === 'string' ? b.description.trim().slice(0, 500) : '',
    starts_at: typeof b.startsAt === 'string' ? b.startsAt.trim().slice(0, 40) : '',
  };
}
