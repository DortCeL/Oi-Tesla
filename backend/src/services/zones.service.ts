import { prisma } from "../db/prisma.js";

export async function listZones() {
  return prisma.zone.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
    },
  });
}
