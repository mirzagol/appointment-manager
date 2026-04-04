require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIST_PATH = path.join(__dirname, "../../frontend/dist");
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
const WORKSHOP_NAMES = [
  "Robotik Kodlama Atölyesi",
  "Ahşap ve Marangozluk Atölyesi",
  "Sanat ve El İşi Atölyesi",
  "Müzik ve Ritim Atölyesi",
  "Minik Şefler Atölyesi",
  "Hareket ve Oyun Atölyesi"
];

function getWorkshopName(room) {
  if (!room) {
    return "";
  }

  const rawName = String(room.name || "").trim();
  const indexedName =
    typeof room.id === "number" ? WORKSHOP_NAMES[room.id - 1] || "" : "";

  if (!rawName) {
    return indexedName;
  }

  if (
    /^\d+$/.test(rawName) ||
    /^at(?:ö|o)lye\s*\d+$/i.test(rawName) ||
    /^oda\s*\d+$/i.test(rawName)
  ) {
    return indexedName || rawName;
  }

  return rawName;
}

function buildRoomSessionCsvRows(form) {
  return form.rows.map((row) => {
    const csvRow = { "Katılımcı No": row.attendeeNo };
    for (const slot of form.timeSlots) {
      csvRow[slot] = row[slot] || "";
    }
    return csvRow;
  });
}

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "no-referrer"); 
  next();
});

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
    return res.status(401).json({ error: "Yönetici erişim izni bulunamadı." });
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

  if (!allFull) {
    return false;
  }

  // All sessions are currently at capacity, so extend each session by 5 spots.
  await tx.session.updateMany({
    data: {
      capacity: {
        increment: 5
      }
    }
  });

  return true;
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
      roomName: getWorkshopName(session.room),
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
        error: "Ad, soyad, yaş ve telefon numarası zorunludur."
      });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge <= 0) {
      return res.status(400).json({ error: "Yaş pozitif bir tam sayı olmalıdır." });
    }

    const normalizedPhoneNumber = String(phoneNumber).trim();
    if (normalizedPhoneNumber.length < 7) {
      return res.status(400).json({ error: "Telefon numarası geçersiz." });
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
        .json({ error: "Bu telefon numarası ile kayıt zaten var." });
    }
    return res.status(500).json({ error: "Kullanıcı oluşturulamadı." });
  }
});

app.post("/reservations", async (req, res) => {
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) {
    return res
      .status(400)
      .json({ error: "Rezervasyon için userId ve sessionId zorunludur." });
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
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }
    if (error.message === "SESSION_NOT_FOUND") {
      return res.status(404).json({ error: "Oturum bulunamadı." });
    }
    if (error.message === "ALREADY_BOOKED_IN_ROOM") {
      return res.status(409).json({
        error: "Bir kullanıcı aynı atölyeden yalnızca bir oturum seçebilir."
      });
    }
    if (error.message === "MAX_ROOMS_REACHED") {
      return res.status(409).json({
        error: "Bir kullanıcı en fazla 4 atölye seçebilir."
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
    return res.status(500).json({ error: "Rezervasyon oluşturulamadı." });
  }
});

app.get("/sessions", async (_req, res) => {
  try {
    const sessions = await getSessionAvailability();
    return res.json({ sessions });
  } catch (error) {
    console.error("GET /sessions error:", error);
    return res.status(500).json({ error: "Oturumlar yüklenemedi." });
  }
});

app.get("/users/:id/reservations", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
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
    return res.status(500).json({ error: "Rezervasyonlar yüklenemedi." });
  }
});

app.get("/admin/sessions-by-room", requireAdmin, async (_req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        room: true,
        _count: {
          select: { reservations: true }
        }
      },
      orderBy: [{ roomId: "asc" }, { startTime: "asc" }]
    });

    const grouped = {};
    for (const session of sessions) {
      const roomName = getWorkshopName(session.room);
      if (!grouped[roomName]) {
        grouped[roomName] = [];
      }
      grouped[roomName].push({
        id: session.id,
        roomId: session.roomId,
        startTime: session.startTime,
        endTime: session.endTime,
        capacity: session.capacity,
        reservedCount: session._count.reservations,
        availableSpots: Math.max(session.capacity - session._count.reservations, 0)
      });
    }

    return res.json(grouped);
  } catch (error) {
    console.error("GET /admin/sessions-by-room error:", error);
    return res.status(500).json({ error: "Oturumlar yüklenemedi." });
  }
});

app.patch("/admin/sessions/:sessionId/capacity", requireAdmin, async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const { newCapacity } = req.body;

    if (!Number.isInteger(newCapacity) || newCapacity < 1) {
      return res.status(400).json({ error: "Kapasite pozitif bir tam sayı olmalıdır." });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        _count: {
          select: { reservations: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: "Oturum bulunamadı." });
    }

    const allSessions = await prisma.session.findMany({
      include: {
        _count: {
          select: { reservations: true }
        }
      }
    });

    const allFull = allSessions.every(
      (s) => s._count.reservations >= s.capacity
    );

    // If all sessions are full, max capacity is 10
    const maxAllowed = allFull ? 10 : 999999;
    if (newCapacity > maxAllowed) {
      return res.status(400).json({
        error: `Tüm oturumlar dolu olduğunda maksimum kapasite ${maxAllowed} dir.`
      });
    }

    // Also ensure we don't go below reserved count
    if (newCapacity < session._count.reservations) {
      return res.status(400).json({
        error: `Kapasite, mevcut rezervasyon sayısından (${session._count.reservations}) az olamaz.`
      });
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: { capacity: newCapacity },
      include: {
        room: true,
        _count: {
          select: { reservations: true }
        }
      }
    });

    return res.json({
      id: updated.id,
      roomId: updated.roomId,
      startTime: updated.startTime,
      endTime: updated.endTime,
      capacity: updated.capacity,
      reservedCount: updated._count.reservations
    });
  } catch (error) {
    console.error("PATCH /admin/sessions/:sessionId/capacity error:", error);
    return res.status(500).json({ error: "Kapasite güncellenemedi." });
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
          "Katılımcı No": reservation.user.id,
          Ad: reservation.user.name,
          Soyad: reservation.user.lastName,
          "Telefon Numarası": reservation.user.phoneNumber,
          Yaş: reservation.user.age
        });
      }
      const slotKey = `${reservation.session.startTime}-${reservation.session.endTime}`;
      userMap.get(key)[slotKey] = getWorkshopName(reservation.session.room);
    }

    const peopleBySession = Array.from(userMap.values())
      .sort((a, b) => a["Katılımcı No"] - b["Katılımcı No"])
      .map((row) => {
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
            return getWorkshopName(reservation.session.room) === roomName && reservationSlot === slot;
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
      roomSessionFormsCsv[form.room] = toCsv(buildRoomSessionCsvRows(form));
    }
    const roomSessionFormsAll = roomSessionForms
      .map((form) => {
        const sectionHeader = `Atölye: ${form.room}`;
        const sectionCsv = toCsv(buildRoomSessionCsvRows(form));
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
    return res.status(500).json({ error: "Yönetici raporları oluşturulamadı." });
  }
});

app.post("/admin/clear-database", requireAdmin, async (_req, res) => {
  try {
    // Delete all reservations first (due to foreign key constraints)
    await prisma.reservation.deleteMany({});

    // Delete all users
    await prisma.user.deleteMany({});

    // Reset all session capacities to 5
    await prisma.session.updateMany({
      data: { capacity: 5 }
    });

    return res.json({ message: "Database cleared successfully. All capacities reset to 5." });
  } catch (error) {
    console.error("POST /admin/clear-database error:", error);
    return res.status(500).json({ error: "Failed to clear database." });
  }
});
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
