# Frontend

Two apps only:

```
frontend/
├── site/          ← Public website (Next.js)     → http://localhost:8081
├── dashboard/     ← App after login (React/Vite) → http://localhost:5173
└── packages/      ← Shared UI code (not an app)
```

## Run (same PC)

Three processes:

```bash
# Terminal 1 — API
cd backend
.\.venv\Scripts\Activate.ps1   # or: source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Terminal 2 — public site
cd frontend
npm run dev:site               # http://localhost:8081

# Terminal 3 — dashboard
cd frontend
npm run dev:dashboard          # http://localhost:5173
```

First-time env (once per machine):

```bash
cp frontend/site/.env.example frontend/site/.env
cp frontend/dashboard/.env.example frontend/dashboard/.env
# backend: copy backend/.env.example → backend/.env and set DB_* 
```

Default superadmin (if seeded): `admin@shikshalab.io` / `Admin@12345`

## Run

```bash
cd frontend
npm install

# Terminal 1 — public site
npm run dev:site

# Terminal 2 — dashboard
npm run dev:dashboard

# Terminal 3 — API (on the backend machine)
cd backend && python manage.py runserver 0.0.0.0:8000
python manage.py seed_superadmin
```

## Split PCs (backend on one machine, frontend on another)

Backend PC IP (this project): **`192.168.100.154`**

1. **Backend PC** — start Django on all interfaces:
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```
   Allow port `8000` in Windows Firewall if needed.

2. **Frontend PC** — copy examples and point API at the backend IP:
   ```bash
   cp site/.env.example site/.env
   cp dashboard/.env.example dashboard/.env
   # edit both .env files: set API/origin to http://<backend-ip>:8000
   ```

   Then:
   ```bash
   cd frontend
   npm run dev:site        # http://localhost:8081
   npm run dev:dashboard   # http://localhost:5173
   ```

3. If the backend IP changes, update it in `site/.env` and `dashboard/.env`.

## Auth (no public registration)

1. Super Admin is created via `seed_superadmin` (or Django `createsuperuser`).
2. Only admins create Teacher/Student accounts from the dashboard (temporary password is emailed).
3. Users sign in at **http://localhost:8081/login** with email + password.
4. First login requires a password change.
5. Forgot password: **/forgot-password** → email link → **/reset-password**.

Env (copy `.env.example` → `.env` in each app):

| File | Variable | Value |
|------|----------|-------|
| `site/.env` | `NEXT_PUBLIC_API_URL` | `http://:8000/api/v1` (or backend LAN IP) |
| `site/.env` | `NEXT_PUBLIC_SITE_URL` | `http://localhost:8081` |
| `site/.env` | `NEXT_PUBLIC_DASHBOARD_URL` | `http://localhost:5173` |
| `dashboard/.env` | `VITE_API_URL` | `http://127.0.0.1:8000/api/v1` (or backend LAN IP) |
| `dashboard/.env` | `VITE_WEB_URL` | `http://localhost:8081` |
| `backend/.env` | `FRONTEND_URL` | `http://localhost:8081` |
| `backend/.env` | `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | seeder defaults |

Default superadmin (if none exists): `admin@shikshalab.io` / `Admin@12345`

## Tests

```bash
# Backend API / service tests
cd backend && python -m pytest

# Dashboard unit tests
cd frontend/dashboard && npm test
```
