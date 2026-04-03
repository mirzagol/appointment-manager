# 🎈 Bil Koleji Florya April 23 Workshop System

A modern, mobile-friendly event reservation app for workshop scheduling.
Participants can choose 4 session slots from 6 available workshops, while the system automatically manages capacity.

## ✨ Features

- 📱 Mobile-first interface built with `React` and `Material UI`
- 🔐 Unique participant registration by phone number
- 🧠 Reservation rules:
  - Only 1 selection per workshop
  - Exactly 4 session selections are required
  - Full sessions are disabled automatically
- 📈 Capacity expands automatically from `5` to `10` when all sessions are full
- 🧾 Admin dashboard at `/admin` with CSV export support
- 🗑️ Database clearing tool with automatic backup downloads

## 🛠️ Tech Stack

- Backend: `Node.js` + `Express`
- Database: `SQLite`
- ORM: `Prisma`
- Frontend: `React` + `Vite`
- UI Library: `Material UI`
- Containerization: multi-stage `Dockerfile`

## 🧩 Workshops

1. Robotik Kodlama Atölyesi
2. Ahşap ve Marangozluk Atölyesi
3. Sanat ve El İşi Atölyesi
4. Müzik ve Ritim Atölyesi
5. Minik Şefler Atölyesi
6. Hareket ve Oyun Atölyesi

## ⏱️ Session Times

- 11:30 - 12:00
- 12:00 - 12:30
- 12:30 - 13:00
- 13:00 - 13:30

## 🚀 Local Development

Install dependencies and initialize the database:

```bash
npm install
npm run db:init --workspace backend
```

Then start the backend and frontend in separate terminals:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

Available URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Admin page: `http://localhost:5173/admin`

## 🐳 Docker

Build the image:

```bash
docker build -t appointment-manager .
```

Run the container:

```bash
docker run -p 3000:3000 -e DATABASE_URL=file:/data/dev.db -v appointment-data:/data appointment-manager
```

On startup, the container runs:

- `prisma migrate deploy`
- `prisma db seed`

## 🔌 API Endpoints

- `POST /users` — create a participant
- `GET /sessions` — list session availability
- `POST /reservations` — create a reservation
- `GET /users/:id/reservations` — list a participant's reservations
- `GET /admin/sessions-by-room` — admin session + room capacity / availability (Basic Auth)
- `PATCH /admin/sessions/:sessionId/capacity` — adjust capacity for a session (Basic Auth)
- `GET /admin/reports` — admin report data with CSV payloads (Basic Auth)
- `POST /admin/clear-database` — clear all data and reset capacities (admin only)

## ☁️ Deploy for 30-day demo (Render)

1. Push your code to GitHub (main branch recommended):
   - `git add .`
   - `git commit -m "deploy ready"`
   - `git push origin main`

2. Create a Render account and connect your GitHub repo:
   - https://dashboard.render.com

3. Add backend web service:
   - Service type: `Web Service`
   - Root directory: `backend`
   - Build command:
     - `cd backend && npm install && npm run prisma:migrate && npm run prisma:generate`
   - Start command:
     - `cd backend && npm run start:prod`
   - Environment variables:
     - `DATABASE_URL` = `file:./dev.db` (or PostgreSQL string for persistence)
     - `PORT` = `3000` (Render overrides automatically, can omit)

4. Add static frontend site:
   - Service type: `Static Site`
   - Root directory: `frontend`
   - Build command:
     - `npm install && npm run build`
   - Publish directory: `dist`
   - Environment variable (optional):
     - `VITE_BACKEND_URL` = `https://<your-backend>.onrender.com`

5. Update frontend API URL fallback in `frontend/src/App.jsx` / `AdminPage.jsx`:
   - `const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";`

6. Verify deployed system works:
   - Open frontend URL from Render
   - Admin: `/admin` + Basic Auth check
   - `Clear Database` flow works with backup export

7. 30-day cleanup:
   - Delete Render services after demonstration
   - Delete repository or branch if no longer needed

## ⚙️ Alternative deployment (Railway / Fly.io quick notes)

- Railway:
  - Create new project, deploy backend with same `backend` commands.
  - Add PostgreSQL plugin ideally for durability.
  - Configure `DATABASE_URL` in variables.
  - Delete project after 30 days.

- Fly.io:
  - `flyctl launch` from repo root.
  - Set `DATABASE_URL` in secrets and ensure `SPRING` directories are right.
  - `flyctl deploy`, then `flyctl destroy --yes` when done.

