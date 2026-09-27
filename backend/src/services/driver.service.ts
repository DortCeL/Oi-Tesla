import { RideStatus, Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { getDriverProfile } from "./driverAuth.service.js";
import type { SetDriverStatusInput } from "../validators/driver.validator.js";

const activeRideStatuses: RideStatus[] = [
  RideStatus.WAITING,
  RideStatus.MATCHED,
  RideStatus.IN_PROGRESS,
];

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
        offlineQueued: false,
        activeZoneIds: input.zoneIds ?? [],
      },
    });
  } else {
    const activeRides = await prisma.ride.count({
      where: {
        driverId: userId,
        status: { in: activeRideStatuses },
      },
    });

    if (activeRides > 0) {
      await prisma.driver.update({
        where: { userId },
        data: { offlineQueued: true },
      });
    } else {
      await prisma.driver.update({
        where: { userId },
        data: {
          isOnline: false,
          offlineQueued: false,
          activeZoneIds: [],
        },
      });
    }
  }

  return getDriverProfile(userId);
}

/** Drop a queued offline request so the driver keeps taking rides. */
export async function clearDriverOfflineQueue(userId: string) {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!driver || driver.user.role !== Role.DRIVER) {
    throw new AppError(404, "Driver not found");
  }

  if (driver.offlineQueued) {
    await prisma.driver.update({
      where: { userId },
      data: { offlineQueued: false },
    });
  }

  return getDriverProfile(userId);
}
