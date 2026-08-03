# ShikshaLab Backend

Production-ready Django REST API for **ShikshaLab** — a learning management system for institutes covering courses, batches, enrollments, fees, attendance, assignments, certificates, CMS, notifications, and analytics.

## Split with frontend

Frontend lives in a **separate folder/PC** (`Shikshalab.com/frontend`). Backend developers only need this repo.

```powershell
# Bind to all interfaces so a frontend friend on the LAN can connect
python manage.py runserver 0.0.0.0:8000
```

Give them your LAN IP, e.g. `http://192.168.x.x:8000/api/v1`.  
In development, `CORS_ALLOW_ALL_ORIGINS=True` is already the default.

## Architecture

```
backend/
├── apps/                  # Domain applications
│   ├── common/            # Shared models, permissions, responses, middleware
│   ├── accounts/          # Custom User (email login), profiles, auth
│   ├── roles/             # Roles, permissions, feature flags
│   ├── students/          # Student profiles & related data
│   ├── teachers/          # Teacher profiles & qualifications
│   ├── courses/           # Course catalog & instructors
│   ├── content/           # Chapters, parts, resources, progress
│   ├── batches/           # Batches, shifts, batch students
│   ├── enrollments/       # Enrollment workflow
│   ├── fees/              # Fee structures, invoices, payments
│   ├── assignments/       # Assignments, submissions, reviews
│   ├── attendance/        # Student/teacher attendance
│   ├── certificates/      # Certificate issuance
│   ├── cms/               # CMS pages / content
│   ├── seo/               # SEO metadata
│   ├── notifications/     # In-app / email / SMS notifications
│   └── analytics/         # Dashboards & reports
├── config/                # Django project settings & URL routing
│   ├── settings/          # base, development, production
│   ├── api_urls.py        # /api/v1/ router
│   └── urls.py            # Root URLs (admin, docs, API)
├── requirements/          # base / development / production deps
├── scripts/               # Utility & seed scripts
├── docker-compose.yml
├── Dockerfile
└── manage.py
```

API version prefix: **`/api/v1/`**

Interactive docs: **`/api/docs/`** (Swagger) · **`/api/redoc/`** · schema at **`/api/schema/`**

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Django 6 + Django REST Framework |
| Auth | JWT (`djangorestframework-simplejwt`) |
| API schema | `drf-spectacular` (OpenAPI 3) |
| Filters | `django-filter` |
| DB | SQLite (dev default) / PostgreSQL 16 (Docker / prod) |
| Cache / broker | Redis + Celery |
| Static | WhiteNoise |
| Config | `python-decouple` (`.env`) |
| Audit | `django-auditlog` |
| Server | Gunicorn (production) |

## Roles

| Role | Access |
|------|--------|
| **ADMIN** | Full platform access, broadcasts, all analytics |
| **TEACHER** | Own courses/batches, assignments, attendance; scoped analytics |
| **STUDENT** | Own enrollments, submissions, fees, notifications |

Role codes live on `accounts.User.role` (`ADMIN` / `TEACHER` / `STUDENT`). Staff/superuser are treated as admin by permission helpers in `apps.common.permissions`.

## Setup

### 1. Clone & virtualenv

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements/development.txt
```

### 2. Environment

```bash
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
```

Edit `.env` and set PostgreSQL credentials (`DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`). PostgreSQL is required.

### 3. Migrate & seed

```bash
python manage.py migrate
python manage.py seed_roles
python manage.py createsuperuser
# optional: wipe leftover demo/seed rows
# python scripts/clear_demo_data.py
```

### 4. Run

```bash
python manage.py runserver
```

- API: http://127.0.0.1:8000/api/v1/
- Docs: http://127.0.0.1:8000/api/docs/
- Admin: http://127.0.0.1:8000/admin/

### Tests (critical paths)

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest
# or: pytest
```

Uses `config.settings.test` (SQLite in-memory). CI: `.github/workflows/backend-tests.yml`.

### Docker Compose

```bash
copy .env.example .env
docker compose up --build
```

Starts **web** (Gunicorn + migrate + collectstatic), **Postgres 16**, and **Redis 7**. App listens on port **8000**.

## Auth

Obtain tokens:

```http
POST /api/v1/auth/token/
Content-Type: application/json

{"email": "admin@example.com", "password": "..."}
```

Or use accounts helpers:

- `POST /api/v1/accounts/auth/login/`
- `POST /api/v1/accounts/auth/register/`
- `POST /api/v1/accounts/auth/token/refresh/`

Send `Authorization: Bearer <access>` on protected routes.

## Module overview (main endpoints)

All paths below are under `/api/v1/`.

### Accounts & roles
- `accounts/auth/*` — register, login, logout, profile, change password
- `accounts/users/` — user admin
- `roles/roles/`, `roles/permissions/`, `roles/feature-flags/`

### Academic
- `students/`, `teachers/`, `courses/`, `content/`
- `batches/`, `enrollments/` — approve / reject / cancel / complete actions
- `assignments/`, `attendance/`

### Finance & credentials
- `fees/structures/`, `fees/payments/`, `fees/invoices/`, …
- `certificates/` — issue, revoke, regenerate QR
- **Public verify:** `GET /api/v1/certificates/verify/{verification_code}/` (no auth)

### CMS / SEO
- `cms/` — banners, pages, blogs, events, gallery, testimonials, FAQs, careers, announcements, contact
- `seo/` — metadata, sitemap entries, redirect rules, SEO score action

### Notifications
- `GET/DELETE notifications/` — own inbox (filter: `is_read`, `notification_type`, …)
- `POST notifications/{id}/mark_read/`
- `POST notifications/mark_all_read/`
- `GET notifications/unread_count/`
- `POST notifications/broadcast/` — **admin** create/broadcast (`BroadcastNotificationSerializer`)
- `GET/PATCH notifications/preferences/me/` — channel & per-type toggles

**Integration (preferred):** other apps call:

```python
from apps.notifications.services import (
    notify_user,
    notify_users,
    mark_all_read,
    notify_enrollment_approved,
    notify_assignment_created,
    notify_payment_received,
    notify_certificate_issued,
)
```

Optional Django signals in `apps.notifications.signals` auto-hook enrollment approved/active, published assignments, successful payments, and certificates when those models exist (`apps.get_model` / safe try-except).

### Analytics (admin + teacher)
- `GET analytics/dashboard/` — students, teachers, courses, active batches, pending enrollments, revenue this month, certificates, attendance rate
- `GET analytics/enrollments/trends/?months=12`
- `GET analytics/students/growth/`
- `GET analytics/revenue/summary/`
- `GET analytics/attendance/reports/?days=30`
- `GET analytics/assignments/completion/`
- `GET analytics/certificates/stats/`
- `GET analytics/teachers/performance/`
- `analytics/saved-reports/` — optional saved report configs

Teachers receive **scoped** stats for their own batches/courses where applicable; admins see platform-wide figures. Missing tables return zeros / graceful payloads.

Standard JSON envelope from many endpoints:

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "errors": null
}
```

## Production notes

1. **Secrets** — set a strong `SECRET_KEY`; never commit `.env`.
2. **Settings** — use `DJANGO_SETTINGS_MODULE=config.settings.production` (Compose does this).
3. **Database** — Postgres via `DB_*` env vars; enable connection pooling / `DB_CONN_MAX_AGE`.
4. **HTTPS** — `SECURE_SSL_REDIRECT`, HSTS, and secure cookies are configured in production settings.
5. **Static / media** — `collectstatic` + WhiteNoise for static; serve `MEDIA_ROOT` via CDN or object storage (`django-storages`) in real deployments.
6. **CORS** — set `CORS_ALLOWED_ORIGINS` to your frontend origin(s); disable `CORS_ALLOW_ALL_ORIGINS` in production.
7. **Redis / Celery** — required for async tasks and recommended caching in prod.
8. **Sentry** — optional `SENTRY_DSN` for error tracking.
9. **Migrations** — always run `migrate` before traffic; prefer zero-downtime expand/contract for large schema changes.
10. **Backups** — schedule Postgres backups and media backups.
11. **Throttling** — tune `THROTTLE_ANON` / `THROTTLE_USER` in production settings.
12. **Workers** — run Gunicorn with multiple workers behind a reverse proxy (Nginx / Traefik).

## Management commands

| Command | Purpose |
|---------|---------|
| `python manage.py seed_roles` | Seed system roles, permissions, feature flags |
| `python scripts/clear_demo_data.py` | Wipe CMS/catalog/demo rows from the database |
| `python manage.py createsuperuser` | Create admin user (email-based) |

## License

Proprietary — ShikshaLab. All rights reserved.
