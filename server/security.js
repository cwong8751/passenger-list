import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error('APP_SECRET must be set to a random string of 16+ characters');
  return s;
}
const encKey = () => crypto.createHash('sha256').update('enc:' + secret()).digest();

// PINs only have 10k possibilities, so a leaked hash would be trivially crackable.
// Peppering with a server-side secret (kept out of the database) prevents offline cracking.
const pepper = (v) => crypto.createHmac('sha256', secret()).update(v).digest('base64');
export const hashSecret = (v) => bcrypt.hash(pepper(v), 10);
export const checkSecret = (v, hash) => bcrypt.compare(pepper(v), hash);

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}
export function decrypt(blob) {
  const [iv, tag, ct] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

const jwtKey = () => crypto.createHash('sha256').update('jwt:' + secret()).digest();
export const signToken = (user) =>
  jwt.sign({ sub: user.id, tv: user.token_version }, jwtKey(), { expiresIn: '7d' });
export function verifyToken(token) {
  try {
    return jwt.verify(token, jwtKey());
  } catch {
    return null;
  }
}

export const randomPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');
