# Appointment Manager

Full-stack appointment management system for a one-day event with 6 rooms and 4 sessions per room.

## Stack

- Backend: Node.js + Express
- Database: SQLite + Prisma
- Frontend: React + MUI
- Container: Single Docker image (multi-stage)

## Local Run

1. Install dependencies:

```bash
npm install
```

2. Set environment:

```bash
cp backend/.env.example backend/.env
```

3. Run migrations and seed:

```bash
npm run db:init --workspace backend
```

4. Run frontend and backend in separate terminals:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

Frontend default URL: `http://localhost:5173`  
Backend default URL: `http://localhost:3000`

## Production Build

Build frontend:

```bash
npm run build --workspace frontend
```

Run backend (serves `frontend/dist`):

```bash
npm run start --workspace backend
```

## Docker

Build:

```bash
docker build -t appointment-manager .
```

Run:

```bash
docker run -p 3000:3000 -e DATABASE_URL=file:/data/dev.db -v appointment-data:/data appointment-manager
```

On container startup:

- `prisma migrate deploy` runs automatically.
- `prisma db seed` ensures rooms and sessions exist.

## API

- `POST /users` create user
- `GET /sessions` list sessions with availability
- `POST /reservations` create reservation
- `GET /users/:id/reservations` view user reservations
