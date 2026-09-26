import { Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { getDriverProfile } from "./driverAuth.service.js";
import type { SetDriverStatusInput } from "../validators/driver.validator.js";

export async function setDriverOnlineStatus(
  userId: string,
  input: SetDriverStatusInput,
) {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!driver || driver.user.role !== Role.DRIVER) {
    throw new AppError(404, "Driver not found");
  }

  if (input.isOnline) {
    const zones = await prisma.zone.findMany({
      where: { id: { in: input.zoneIds ?? [] } },
      select: { id: true },
    });

    if (zones.length !== (input.zoneIds?.length ?? 0)) {
      throw new AppError(400, "One or more zones are invalid");
    }

    await prisma.driver.update({
      where: { userId },
      data: {
        isOnline: true,
        activeZoneIds: input.zoneIds ?? [],
      },
    });
  } else if (driver.isOnline) {
    await prisma.driver.update({
      where: { userId },
      data: { isOnline: false },
    });
  }

  return getDriverProfile(userId);
}
