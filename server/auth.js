import { one } from './db.js';
import { verifyToken } from './security.js';
import { HttpError } from './validate.js';

export const COOKIE = 'pl_session';
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
});

export async function requireUser(req, res, next) {
  const payload = verifyToken(req.cookies?.[COOKIE]);
  const user = payload && (await one('SELECT * FROM users WHERE id = ?', [payload.sub]));
  // token_version changes whenever an admin resets a PIN, invalidating old sessions
  if (!user || user.token_version !== payload.tv) throw new HttpError(401, 'Please sign in');
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Not allowed');
  next();
};
