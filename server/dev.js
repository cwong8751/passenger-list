// Local / self-hosted entry point. On Vercel, api/index.js is used instead.
import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';

try { process.loadEnvFile('.env'); } catch { /* env provided by the host */ }
const { default: api } = await import('./app.js');

const app = express();
app.use(api);
const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
