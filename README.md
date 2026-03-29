# 🎈 Bil Koleji Florya 23 Nisan Atölye Sistemi

Modern, mobil odaklı etkinlik rezervasyon uygulaması.  
Katılımcılar 6 atölye arasından 4 oturum seçer, sistem kapasiteyi otomatik yönetir. 🚀

## ✨ Özellikler

- 📱 React + MUI ile mobil öncelikli arayüz
- 🔐 Telefon numarası ile tekil katılımcı kaydı
- 🧠 İş kuralları:
  - Her atölyeden sadece 1 seçim
  - Toplam 4 seçim zorunlu
  - Dolu oturumlar pasif
- 📈 Tüm oturumlar dolunca kapasite otomatik `5 -> 10`
- 🧾 Admin paneli (`/admin`) + CSV raporları

## 🛠️ Teknoloji Yığını

- Backend: `Node.js` + `Express`
- Veritabanı: `SQLite`
- ORM: `Prisma`
- Frontend: `React` + `Material UI`
- Container: Tek imaj, multi-stage `Dockerfile`

## 🧩 Atölyeler

1. Robotik Kodlama Atölyesi
2. Ahşap ve Marangozluk Atölyesi
3. Sanat ve El işi atölyesi
4. Müzik ve Ritim Atölyesi
5. Minik Şefler Atölyesi
6. Hareket ve Oyun Atölyesi

## ⏱️ Oturum Saatleri

- 11:30 - 12:00
- 12:00 - 12:30
- 12:30 - 13:00
- 13:00 - 13:30

## 🚀 Lokal Çalıştırma

```bash
npm install
cp backend/.env.example backend/.env
npm run db:init --workspace backend
```

Ayrı terminallerde:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## 🐳 Docker

Build:

```bash
docker build -t appointment-manager .
```

Run:

```bash
docker run -p 3000:3000 -e DATABASE_URL=file:/data/dev.db -v appointment-data:/data appointment-manager
```

Container açılışında:

- `prisma migrate deploy`
- `prisma db seed`

## 🔌 API Uç Noktaları

- `POST /users` -> kullanıcı oluşturur
- `GET /sessions` -> oturum uygunluklarını listeler
- `POST /reservations` -> rezervasyon oluşturur
- `GET /users/:id/reservations` -> kullanıcı rezervasyonları
- `GET /admin/reports` -> admin raporları (Basic Auth)
