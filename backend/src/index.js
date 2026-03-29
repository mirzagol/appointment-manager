const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const prisma = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIST_PATH = path.join(__dirname, "../../frontend/dist");

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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
        error: "name, lastName, age, and phoneNumber are required."
      });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge <= 0) {
      return res.status(400).json({ error: "age must be a positive integer." });
    }

    const normalizedPhoneNumber = String(phoneNumber).trim();
    if (normalizedPhoneNumber.length < 7) {
      return res.status(400).json({ error: "phoneNumber is invalid." });
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
        .json({ error: "This phone number is already registered." });
    }
    return res.status(500).json({ error: "Failed to create user." });
  }
});

app.post("/reservations", async (req, res) => {
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) {
    return res
      .status(400)
      .json({ error: "userId and sessionId are required for booking." });
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
      return res.status(404).json({ error: "User not found." });
    }
    if (error.message === "SESSION_NOT_FOUND") {
      return res.status(404).json({ error: "Session not found." });
    }
    if (error.message === "ALREADY_BOOKED_IN_ROOM") {
      return res.status(409).json({
        error: "User can only register for one session per room."
      });
    }
    if (error.message === "MAX_ROOMS_REACHED") {
      return res.status(409).json({
        error: "User cannot book more than 4 rooms."
      });
    }
    if (error.message === "SESSION_FULL") {
      return res.status(409).json({
        error: "This session is currently full."
      });
    }
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "This reservation already exists."
      });
    }
    return res.status(500).json({ error: "Failed to create reservation." });
  }
});

app.get("/sessions", async (_req, res) => {
  try {
    const sessions = await getSessionAvailability();
    return res.json({ sessions });
  } catch (error) {
    console.error("GET /sessions error:", error);
    return res.status(500).json({ error: "Failed to load sessions." });
  }
});

app.get("/users/:id/reservations", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
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
    return res.status(500).json({ error: "Failed to load reservations." });
  }
});

app.use(express.static(FRONTEND_DIST_PATH));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/users") || req.path.startsWith("/sessions") || req.path.startsWith("/reservations")) {
    return next();
  }
  return res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
