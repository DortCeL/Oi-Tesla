import "dotenv/config";
import { PrismaClient, Gender, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

/**
 * T-junction. Fares use these path lengths, not the lat/lng values.
 *
 *   Banani —— Mohakhali —— Gulshan 1 —— Bashundhara
 *                 |
 *              Farmgate
 *                 |
 *               Mirpur
 *
 * Edges: Banani–Mohakhali 2km, Mohakhali–Gulshan 1 2km,
 * Gulshan 1–Bashundhara 2.5km, Mohakhali–Farmgate 3km, Farmgate–Mirpur 3.5km.
 */
const ZONES = [
  { name: "Banani", lat: "23.793600", lng: "90.404400" },
  { name: "Mohakhali", lat: "23.777800", lng: "90.403300" },
  { name: "Gulshan 1", lat: "23.780800", lng: "90.415600" },
  { name: "Bashundhara", lat: "23.815900", lng: "90.424700" },
  { name: "Farmgate", lat: "23.758800", lng: "90.389000" },
  { name: "Mirpur", lat: "23.806700", lng: "90.368300" },
] as const;

const DISTANCES: Record<string, Record<string, number>> = {
  Banani: {
    Mohakhali: 2000,
    "Gulshan 1": 4000,
    Bashundhara: 6500,
    Farmgate: 5000,
    Mirpur: 8500,
  },
  Mohakhali: {
    Banani: 2000,
    "Gulshan 1": 2000,
    Bashundhara: 4500,
    Farmgate: 3000,
    Mirpur: 6500,
  },
  "Gulshan 1": {
    Banani: 4000,
    Mohakhali: 2000,
    Bashundhara: 2500,
    Farmgate: 5000,
    Mirpur: 8500,
  },
  Bashundhara: {
    Banani: 6500,
    Mohakhali: 4500,
    "Gulshan 1": 2500,
    Farmgate: 7500,
    Mirpur: 11000,
  },
  Farmgate: {
    Banani: 5000,
    Mohakhali: 3000,
    "Gulshan 1": 5000,
    Bashundhara: 7500,
    Mirpur: 3500,
  },
  Mirpur: {
    Banani: 8500,
    Mohakhali: 6500,
    "Gulshan 1": 8500,
    Bashundhara: 11000,
    Farmgate: 3500,
  },
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Clear in FK-safe order (no rides seeded — those come from the app)
  await prisma.rideEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.tesla.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.zoneDistance.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.user.deleteMany();

  for (const zone of ZONES) {
    await prisma.zone.create({ data: zone });
  }

  const zones = await prisma.zone.findMany();
  const zoneByName = Object.fromEntries(zones.map((z) => [z.name, z.id]));

  for (const [fromName, targets] of Object.entries(DISTANCES)) {
    for (const [toName, distanceM] of Object.entries(targets)) {
      await prisma.zoneDistance.create({
        data: {
          fromZoneId: zoneByName[fromName],
          toZoneId: zoneByName[toName],
          distanceM,
        },
      });
    }
  }

  // Jashim — driver, owns Bullet (3 seats)
  const jashim = await prisma.user.create({
    data: {
      name: "Jashim",
      email: "jashim@oitesla.test",
      phone: "+8801710000001",
      passwordHash,
      role: Role.DRIVER,
      gender: Gender.MALE,
      driver: {
        create: { isOnline: false },
      },
    },
  });

  await prisma.tesla.create({
    data: {
      driverId: jashim.id,
      name: "Bullet",
      capacity: 3,
      isActive: true,
    },
  });

  // Nusrat — Banani → Bashundhara in the story
  await prisma.user.create({
    data: {
      name: "Nusrat",
      email: "nusrat@oitesla.test",
      phone: "+8801710000002",
      passwordHash,
      role: Role.PASSENGER,
      gender: Gender.FEMALE,
      passenger: {
        create: {},
      },
    },
  });

  // Rafiq — Banani → Gulshan 1 in the story
  await prisma.user.create({
    data: {
      name: "Rafiq",
      email: "rafiq@oitesla.test",
      phone: "+8801710000003",
      passwordHash,
      role: Role.PASSENGER,
      gender: Gender.MALE,
      passenger: {
        create: {},
      },
    },
  });

  // Shirin — for the last-seat race later
  await prisma.user.create({
    data: {
      name: "Shirin",
      email: "shirin@oitesla.test",
      phone: "+8801710000004",
      passwordHash,
      role: Role.PASSENGER,
      gender: Gender.FEMALE,
      passenger: {
        create: {},
      },
    },
  });

  console.log("Seed complete.");
  console.log(`Demo password for all users: ${DEMO_PASSWORD}`);
  console.log("Users: jashim, nusrat, rafiq, shirin @oitesla.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
