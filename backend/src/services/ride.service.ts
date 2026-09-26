import { RideStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { toRideResponse } from "../utils/rideMapper.js";

const rideInclude = {
  pickupZone: { select: { id: true, name: true } },
} as const;

export async function markDriverArrival(driverId: string, rideId: string) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: rideInclude,
  });

  if (!ride || ride.driverId !== driverId) {
    throw new AppError(404, "Ride not found");
  }

  if (ride.status !== RideStatus.MATCHED) {
    throw new AppError(400, "Ride must be locked before marking arrival");
  }

  if (ride.arrivedAt) {
    throw new AppError(400, "Arrival already recorded");
  }

  const updated = await prisma.ride.update({
    where: { id: rideId },
    data: { arrivedAt: new Date() },
    include: rideInclude,
  });

  return toRideResponse(updated);
}
