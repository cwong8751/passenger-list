import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { hashSecret } from './security.js';

const url = process.env.TURSO_DATABASE_URL || 'file:data/app.db';
if (url.startsWith('file:')) mkdirSync('data', { recursive: true });

export const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

export async function all(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c) => [c, r[c]])));
}
export async function one(sql, args = []) {
  return (await all(sql, args))[0] || null;
}
export async function exec(sql, args = []) {
  return db.execute({ sql, args });
}

// Every mutation bumps this counter; the realtime stream watches it.
export async function bump() {
  await exec(`UPDATE meta SET value = value + 1 WHERE key = 'version'`);
}
export async function getVersion() {
  return (await one(`SELECT value FROM meta WHERE key = 'version'`)).value;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    secret_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('rider','passenger','admin')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rider_profiles (
    user_id INTEGER PRIMARY KEY,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    displacement INTEGER NOT NULL,
    bike_type TEXT NOT NULL,
    spare_helmet INTEGER NOT NULL,
    takes_passengers INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS passenger_profiles (
    user_id INTEGER PRIMARY KEY,
    helmet_size TEXT NOT NULL,
    first_time INTEGER NOT NULL,
    experience INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
    created_by INTEGER,
    created_at INTEGER NOT NULL,
    ended_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS ride_members (
    ride_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    visible INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (ride_id, user_id)
  )`,
  // code_enc is AES-256-GCM encrypted; it is never returned to the passenger.
  `CREATE TABLE IF NOT EXISTS pickups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    rider_id INTEGER NOT NULL,
    passenger_id INTEGER NOT NULL,
    code_enc TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','dropped','quit','ended')),
    verified INTEGER NOT NULL DEFAULT 0,
    code_attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    ended_at INTEGER
  )`,
  // A rider / passenger can only be in one active pickup; enforced atomically by the DB.
  `CREATE UNIQUE INDEX IF NOT EXISTS pickups_one_active_rider ON pickups(rider_id) WHERE status = 'active'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pickups_one_active_passenger ON pickups(passenger_id) WHERE status = 'active'`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)`,
  `INSERT OR IGNORE INTO meta (key, value) VALUES ('version', 0)`,
];

async function setup() {
  await db.batch(SCHEMA, 'write');
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (ADMIN_USERNAME && ADMIN_PASSWORD) {
    const existing = await one(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (!existing) {
      await exec(
        `INSERT OR IGNORE INTO users (username, secret_hash, role, created_at) VALUES (?, ?, 'admin', ?)`,
        [ADMIN_USERNAME, await hashSecret(ADMIN_PASSWORD), Date.now()],
      );
      console.log(`Seeded first administrator "${ADMIN_USERNAME}"`);
    }
  }
}

let ready;
export function init() {
  return (ready ??= setup().catch((e) => {
    ready = null;
    throw e;
  }));
}
