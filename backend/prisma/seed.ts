import "dotenv/config";
import { PrismaClient, Gender, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

// Approximate lat/lng for Dhaka areas (hand-picked, not from a maps API)
const ZONES = [
  { name: "Banani", lat: "23.793600", lng: "90.404400" },
  { name: "Gulshan 1", lat: "23.780800", lng: "90.415600" },
  { name: "Mohakhali", lat: "23.777800", lng: "90.403300" },
  { name: "Dhanmondi", lat: "23.746100", lng: "90.374200" },
  { name: "Mirpur", lat: "23.806700", lng: "90.368300" },
  { name: "Uttara", lat: "23.875900", lng: "90.379500" },
  { name: "Farmgate", lat: "23.758800", lng: "90.389000" },
  { name: "Bashundhara", lat: "23.815900", lng: "90.424700" },
] as const;

// Distances in meters — round numbers, hand-testable for fare calc.
//
// PRD corridor (Banani pickup, rush-hour story):
//   Banani ──2 km── Mohakhali (Nusrat) ──2 km── Gulshan 1 (Rafiq)
// Nusrat books first → Mohakhali; Rafiq joins same pool → Gulshan 1.
const DISTANCES: Record<string, Record<string, number>> = {
  Banani: {
    "Gulshan 1": 4000,
    Mohakhali: 2000,
    Dhanmondi: 4500,
    Mirpur: 6000,
    Uttara: 8500,
    Farmgate: 3500,
    Bashundhara: 3000,
  },
  "Gulshan 1": {
    Banani: 4000,
    Mohakhali: 2000,
    Dhanmondi: 5000,
    Mirpur: 6500,
    Uttara: 7000,
    Farmgate: 4000,
    Bashundhara: 2500,
  },
  Mohakhali: {
    Banani: 2000,
    "Gulshan 1": 2000,
    Dhanmondi: 3500,
    Mirpur: 5500,
    Uttara: 8000,
    Farmgate: 3000,
    Bashundhara: 4000,
  },
  Dhanmondi: {
    Banani: 4500,
    "Gulshan 1": 5000,
    Mohakhali: 3500,
    Mirpur: 7000,
    Uttara: 12000,
    Farmgate: 2000,
    Bashundhara: 6500,
  },
  Mirpur: {
    Banani: 6000,
    "Gulshan 1": 6500,
    Mohakhali: 5500,
    Dhanmondi: 7000,
    Uttara: 5000,
    Farmgate: 6500,
    Bashundhara: 7500,
  },
  Uttara: {
    Banani: 8500,
    "Gulshan 1": 7000,
    Mohakhali: 8000,
    Dhanmondi: 12000,
    Mirpur: 5000,
    Farmgate: 11000,
    Bashundhara: 6000,
  },
  Farmgate: {
    Banani: 3500,
    "Gulshan 1": 4000,
    Mohakhali: 3000,
    Dhanmondi: 2000,
    Mirpur: 6500,
    Uttara: 11000,
    Bashundhara: 5500,
  },
  Bashundhara: {
    Banani: 3000,
    "Gulshan 1": 2500,
    Mohakhali: 4000,
    Dhanmondi: 6500,
    Mirpur: 7500,
    Uttara: 6000,
    Farmgate: 5500,
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
      hobbies: ["football", "cricket"],
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

  // Nusrat — Banani → Mohakhali in the story
  await prisma.user.create({
    data: {
      name: "Nusrat",
      email: "nusrat@oitesla.test",
      phone: "+8801710000002",
      passwordHash,
      role: Role.PASSENGER,
      gender: Gender.FEMALE,
      hobbies: ["reading", "music"],
      passenger: {
        create: {
          occupation: "Software Engineer",
          affiliation: "Grameenphone",
        },
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
      hobbies: ["photography"],
      passenger: {
        create: {
          occupation: "Bank Officer",
          affiliation: "BRAC Bank",
        },
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
      hobbies: ["cooking", "travel"],
      passenger: {
        create: {
          occupation: "Student",
          affiliation: "North South University",
        },
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
