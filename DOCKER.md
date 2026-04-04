# Deploy with Docker Compose

This stack runs the **API** (Node + Prisma + SQLite) and the **static UI** (nginx) as two services. On each backend start, **migrations** run automatically (`prisma migrate deploy`), then **seed** ensures rooms and sessions exist (idempotent upserts).

## Requirements

- Docker Engine 20.10+ and Docker Compose V2 (`docker compose`)

## Quick start

From the repository root:

```bash
make up
```

Or:

```bash
docker compose up -d --build
```

### URLs

| Service   | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:5173        |
| Backend  | http://localhost:3000      |

Admin UI: http://localhost:5173/admin (default Basic Auth in app: `admin` / `admin` — change for production).

## Makefile targets

| Target    | Description                          |
|-----------|--------------------------------------|
| `make up` | Build (if needed) and start detached |
| `make up-fg` | Start in foreground (logs inline) |
| `make down` | Stop containers                   |
| `make build` | Build images only               |
| `make logs` | Follow compose logs             |
| `make ps` | Show container status            |
| `make clean` | Stop and remove volumes + local images |
| `make restart` | `down` then `up`              |

## Data persistence

SQLite lives in a named volume mounted at **`/data`** in the backend container as `dev.db` (`DATABASE_URL=file:/data/dev.db`). Removing the volume deletes all reservation data:

```bash
docker compose down -v
```

## Production build: API URL for the browser

The frontend is built with Vite. `VITE_API_BASE_URL` is **baked in at image build time**. For local Compose, `docker-compose.yml` sets it to `http://localhost:3000`.

For a public server, set the build arg to your API origin before building, for example:

```bash
docker compose build --build-arg VITE_API_BASE_URL=https://api.example.com frontend
docker compose up -d
```

Or edit `docker-compose.yml` under `frontend.build.args.VITE_API_BASE_URL`.

## Image layout

- `backend/Dockerfile` — monorepo install from repo root, runs `backend/start.sh` (migrate → seed → `node`).
- `frontend/Dockerfile` — multi-stage Vite build + `frontend/nginx.conf` for SPA routing.

## Troubleshooting

- **Backend unhealthy**: Check `docker compose logs backend`. Ensure `/data` is writable (Compose volume handles this).
- **Frontend cannot reach API**: Confirm `VITE_API_BASE_URL` matches a URL reachable from the **user’s browser** (not `http://backend:3000` unless you terminate TLS and DNS there).
