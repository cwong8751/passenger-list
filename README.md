# Passenger List

Riders pick up passengers on group motorcycle rides. React + Express + libSQL (SQLite-compatible).

- **Riders**: register (username + 4 digit PIN + bike info), join the active ride, go visible, pick up a passenger, get a 4 digit pickup code, drop and pick up someone new.
- **Passengers**: register (username + 4 digit PIN + helmet size / experience), join the ride, see their rider + bike once picked up, enter the pickup code, quit any time.
- **Admins**: metrics dashboard, create/end rides, remove users, reset PINs/passwords, create more admins.
- Everything is realtime (server-sent events). CSS is `normalize.css` plus one hand-written stylesheet, no frameworks.

## Run locally

```bash
npm install
cp .env.example .env   # set APP_SECRET (openssl rand -hex 32) and ADMIN_PASSWORD
npm run dev            # web on http://localhost:5173, API on :3001
```

The first admin is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on first start. Admins sign in on the same form (enter the password in the PIN box). Locally the database is `data/app.db`.

Self-host: `npm run build && npm start` (serves the API and the built client on one port).

## Deploy to Vercel

1. Create a free [Turso](https://turso.tech) database: `turso db create passenger-list`, then `turso db show passenger-list --url` and `turso db tokens create passenger-list`.
2. Import the repo into Vercel and set the env vars `APP_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
3. Deploy. Tables are created automatically on first request.

Vercel's filesystem is ephemeral, so a hosted database (Turso) is required there. The API is the Express app exported from `api/index.js`; `vercel.json` routes `/api/*` to it and everything else to the SPA.

## Security notes

- PINs/passwords are bcrypt-hashed *and* peppered with `APP_SECRET` (a 4 digit PIN would otherwise be crackable from a leaked database). 5 wrong sign-ins lock the account for 5 minutes.
- Pickup codes are AES-256-GCM encrypted at rest, only ever sent to the rider, and passengers get 5 attempts per pickup.
- Sessions are httpOnly, SameSite=Lax cookies (JWT, 7 days); resetting a PIN signs that user out everywhere. State-changing requests require an `X-Requested-With` header.
- **Keep `APP_SECRET` stable**: changing it invalidates every PIN, code and session.

## Realtime

Each write bumps a counter in the database; `/api/events` streams it to clients, which refetch their state. Streams last ~25s then `EventSource` reconnects, so it works on serverless platforms that can't hold sockets open.
