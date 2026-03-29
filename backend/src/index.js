const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const prisma = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIST_PATH = path.join(__dirname, "../../frontend/dist");
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
const WORKSHOP_NAMES = [
  "Robotik Kodlama Atölyesi",
  "Ahşap ve Marangozluk Atölyesi",
  "Sanat ve El işi atölyesi",
  "Müzik ve Ritim Atölyesi",
  "Minik Şefler Atölyesi",
  "Hareket ve Oyun Atölyesi"
];

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const csvLines = [headers.join(",")];
  for (const row of rows) {
    csvLines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }
  return csvLines.join("\n");
}

function parseBasicAuth(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
    return null;
  }
  try {
    const encoded = authorizationHeader.slice(6);
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch (_error) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const credentials = parseBasicAuth(req.headers.authorization);
  if (
    !credentials ||
    credentials.username !== ADMIN_USERNAME ||
    credentials.password !== ADMIN_PASSWORD
  ) {
    res.set("WWW-Authenticate", 'Basic realm="Admin Reports"');
    return res.status(401).json({ error: "Unauthorized admin access." });
  }
  return next();
}

async function expandCapacityIfAllSessionsAreFull(tx) {
  const sessions = await tx.session.findMany({
    include: {
      _count: {
        select: {
          reservations: true
        }
      }
    }
  });

  if (sessions.length === 0) {
    return false;
  }

  const allFull = sessions.every(
    (session) => session._count.reservations >= session.capacity
  );
  const hasExpandableSessions = sessions.some((session) => session.capacity < 10);

  if (allFull && hasExpandableSessions) {
    await tx.session.updateMany({
      where: {
        capacity: {
          lt: 10
        }
      },
      data: {
        capacity: 10
      }
    });
    return true;
  }

  return false;
}

async function getSessionAvailability() {
  const sessions = await prisma.session.findMany({
    include: {
      room: true,
      _count: {
        select: { reservations: true }
      }
    },
    orderBy: [{ roomId: "asc" }, { startTime: "asc" }]
  });

  return sessions.map((session) => {
    const reservedCount = session._count.reservations;
    const availableSpots = Math.max(session.capacity - reservedCount, 0);
    return {
      id: session.id,
      roomId: session.roomId,
      roomName: session.room.name,
      startTime: session.startTime,
      endTime: session.endTime,
      capacity: session.capacity,
      reservedCount,
      availableSpots,
      isFull: availableSpots === 0
    };
  });
}

app.post("/users", async (req, res) => {
  try {
    const { name, lastName, age, phoneNumber } = req.body;
    if (!name || !lastName || !age || !phoneNumber) {
      return res.status(400).json({
        error: "Ad, soyad, yas ve telefon numarasi zorunludur."
      });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge <= 0) {
      return res.status(400).json({ error: "Yas pozitif bir tam sayi olmalidir." });
    }

    const normalizedPhoneNumber = String(phoneNumber).trim();
    if (normalizedPhoneNumber.length < 7) {
      return res.status(400).json({ error: "Telefon numarasi gecersiz." });
    }

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        lastName: String(lastName).trim(),
        age: parsedAge,
        phoneNumber: normalizedPhoneNumber
      }
    });

    return res.status(201).json(user);
  } catch (error) {
    console.error("POST /users error:", error);
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Bu telefon numarasi ile kayit zaten var." });
    }
    return res.status(500).json({ error: "Kullanici olusturulamadi." });
  }
});

app.post("/reservations", async (req, res) => {
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) {
    return res
      .status(400)
      .json({ error: "Rezervasyon icin userId ve sessionId zorunludur." });
  }

  try {
    const createdReservation = await prisma.$transaction(async (tx) => {
      await expandCapacityIfAllSessionsAreFull(tx);

      const user = await tx.user.findUnique({
        where: { id: Number(userId) }
      });
      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const targetSession = await tx.session.findUnique({
        where: { id: Number(sessionId) },
        include: {
          room: true,
          _count: {
            select: { reservations: true }
          }
        }
      });
      if (!targetSession) {
        throw new Error("SESSION_NOT_FOUND");
      }

      const existingReservations = await tx.reservation.findMany({
        where: {
          userId: user.id
        },
        include: {
          session: true
        }
      });

      const uniqueRooms = new Set(
        existingReservations.map((reservation) => reservation.session.roomId)
      );

      const alreadyBookedInRoom = existingReservations.some(
        (reservation) => reservation.session.roomId === targetSession.roomId
      );
      if (alreadyBookedInRoom) {
        throw new Error("ALREADY_BOOKED_IN_ROOM");
      }

      if (uniqueRooms.size >= 4) {
        throw new Error("MAX_ROOMS_REACHED");
      }

      if (targetSession._count.reservations >= targetSession.capacity) {
        throw new Error("SESSION_FULL");
      }

      const reservation = await tx.reservation.create({
        data: {
          userId: user.id,
          sessionId: targetSession.id
        },
        include: {
          session: {
            include: {
              room: true
            }
          }
        }
      });

      await expandCapacityIfAllSessionsAreFull(tx);
      return reservation;
    });

    return res.status(201).json(createdReservation);
  } catch (error) {
    console.error("POST /reservations error:", error);
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "Kullanici bulunamadi." });
    }
    if (error.message === "SESSION_NOT_FOUND") {
      return res.status(404).json({ error: "Oturum bulunamadi." });
    }
    if (error.message === "ALREADY_BOOKED_IN_ROOM") {
      return res.status(409).json({
        error: "Bir kullanici ayni atolyeden yalnizca bir oturum secebilir."
      });
    }
    if (error.message === "MAX_ROOMS_REACHED") {
      return res.status(409).json({
        error: "Bir kullanici en fazla 4 atolye secebilir."
      });
    }
    if (error.message === "SESSION_FULL") {
      return res.status(409).json({
        error: "Bu oturum doludur."
      });
    }
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Bu rezervasyon zaten mevcut."
      });
    }
    return res.status(500).json({ error: "Rezervasyon olusturulamadi." });
  }
});

app.get("/sessions", async (_req, res) => {
  try {
    const sessions = await getSessionAvailability();
    return res.json({ sessions });
  } catch (error) {
    console.error("GET /sessions error:", error);
    return res.status(500).json({ error: "Oturumlar yuklenemedi." });
  }
});

app.get("/users/:id/reservations", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: "Kullanici bulunamadi." });
    }

    const reservations = await prisma.reservation.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            room: true
          }
        }
      },
      orderBy: {
        id: "asc"
      }
    });

    return res.json({ user, reservations });
  } catch (error) {
    console.error("GET /users/:id/reservations error:", error);
    return res.status(500).json({ error: "Rezervasyonlar yuklenemedi." });
  }
});

app.get("/admin/reports", requireAdmin, async (_req, res) => {
  try {
    const timeSlots = ["11:30-12:00", "12:00-12:30", "12:30-13:00", "13:00-13:30"];
    const reservations = await prisma.reservation.findMany({
      include: {
        user: true,
        session: {
          include: {
            room: true
          }
        }
      }
    });

    const userMap = new Map();
    for (const reservation of reservations) {
      const key = reservation.user.id;
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: reservation.user.id,
          name: reservation.user.name,
          lastName: reservation.user.lastName,
          phoneNumber: reservation.user.phoneNumber,
          age: reservation.user.age
        });
      }
      const slotKey = `${reservation.session.startTime}-${reservation.session.endTime}`;
      userMap.get(key)[slotKey] = reservation.session.room.name;
    }

    const peopleBySession = Array.from(userMap.values()).map((row) => {
      const normalized = { ...row };
      for (const slot of timeSlots) {
        normalized[slot] = normalized[slot] || "";
      }
      return normalized;
    });

    const roomSessionForms = WORKSHOP_NAMES.map((roomName) => {
      const sessionBuckets = {};
      for (const slot of timeSlots) {
        sessionBuckets[slot] = reservations
          .filter((reservation) => {
            const reservationSlot = `${reservation.session.startTime}-${reservation.session.endTime}`;
            return reservation.session.room.name === roomName && reservationSlot === slot;
          })
          .map((reservation) => {
            return `${reservation.user.name} ${reservation.user.lastName}`.trim();
          });
      }

      const maxRows = Math.max(1, ...timeSlots.map((slot) => sessionBuckets[slot].length));
      const rows = Array.from({ length: maxRows }, (_, index) => {
        const row = { attendeeNo: index + 1 };
        for (const slot of timeSlots) {
          row[slot] = sessionBuckets[slot][index] || "";
        }
        return row;
      });

      return {
        room: roomName,
        timeSlots,
        rows
      };
    });

    const roomSessionFormsCsv = {};
    for (const form of roomSessionForms) {
      roomSessionFormsCsv[form.room] = toCsv(form.rows);
    }
    const roomSessionFormsAll = roomSessionForms
      .map((form) => {
        const sectionHeader = `Room: ${form.room}`;
        const sectionCsv = toCsv(form.rows);
        return `${sectionHeader}\n${sectionCsv}`;
      })
      .join("\n\n");

    return res.json({
      peopleBySession,
      roomSessionForms,
      csv: {
        peopleBySession: toCsv(peopleBySession),
        roomSessionForms: roomSessionFormsCsv,
        roomSessionFormsAll
      }
    });
  } catch (error) {
    console.error("GET /admin/reports error:", error);
    return res.status(500).json({ error: "Admin raporlari olusturulamadi." });
  }
});

app.use(express.static(FRONTEND_DIST_PATH));
app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/users") ||
    req.path.startsWith("/sessions") ||
    req.path.startsWith("/reservations") ||
    req.path.startsWith("/admin")
  ) {
    return next();
  }
  return res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
