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

Build and run with docker-compose:

```bash
docker-compose up --build
```

Frontend on `http://localhost:5173`, backend API on `http://localhost:3000`.

Or run separately:

```bash
# Backend
docker build -t appointment-manager-backend .
docker run -p 3000:3000 appointment-manager-backend

# Frontend
docker build -t appointment-manager-frontend -f Dockerfile.frontend .
docker run -p 5173:80 appointment-manager-frontend
```

## 🔌 API Endpoints

- `POST /users` — create a participant
- `GET /sessions` — list session availability
- `POST /reservations` — create a reservation
- `GET /users/:id/reservations` — list a participant's reservations
- `GET /admin/sessions-by-room` — admin session + room capacity / availability (Basic Auth)
- `PATCH /admin/sessions/:sessionId/capacity` — adjust capacity for a session (Basic Auth)
- `GET /admin/reports` — admin report data with CSV payloads (Basic Auth)
- `POST /admin/clear-database` — clear all data and reset capacities (admin only)
