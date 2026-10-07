import express from 'express';
import cookieParser from 'cookie-parser';
import { init } from './db.js';
import authRoutes from './routes/auth.js';
import rideRoutes from './routes/ride.js';
import adminRoutes from './routes/admin.js';
import { HttpError } from './validate.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', (req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' });
  // Basic CSRF defense on top of SameSite cookies: browsers can't add this header cross-site without CORS.
  if (!['GET', 'HEAD'].includes(req.method) && req.get('X-Requested-With') !== 'fetch')
    return next(new HttpError(403, 'Bad request'));
  init().then(() => next(), next);
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', rideRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return res.end();
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app;
