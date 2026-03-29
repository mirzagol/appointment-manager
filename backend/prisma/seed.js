const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ROOMS = Array.from({ length: 6 }, (_, index) => `Room ${index + 1}`);
const TIME_SLOTS = [
  { startTime: "11:30", endTime: "12:00" },
  { startTime: "12:00", endTime: "12:30" },
  { startTime: "12:30", endTime: "13:00" },
  { startTime: "13:00", endTime: "13:30" }
];

async function main() {
  for (const roomName of ROOMS) {
    await prisma.room.upsert({
      where: { name: roomName },
      update: {},
      create: { name: roomName }
    });
  }

  const rooms = await prisma.room.findMany();
  for (const room of rooms) {
    for (const slot of TIME_SLOTS) {
      await prisma.session.upsert({
        where: {
          roomId_startTime_endTime: {
            roomId: room.id,
            startTime: slot.startTime,
            endTime: slot.endTime
          }
        },
        update: {},
        create: {
          roomId: room.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: 5
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
