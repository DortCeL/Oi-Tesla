import { RequestStatus, RideStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { toRideResponse } from "../utils/rideMapper.js";

const rideInclude = {
  pickupZone: { select: { id: true, name: true } },
} as const;

async function getDriverRide(driverId: string, rideId: string) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: rideInclude,
  });

  if (!ride || ride.driverId !== driverId) {
    throw new AppError(404, "Ride not found");
  }

  return ride;
}

export async function markDriverArrival(driverId: string, rideId: string) {
  const ride = await getDriverRide(driverId, rideId);

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

export async function startRide(driverId: string, rideId: string) {
  const ride = await getDriverRide(driverId, rideId);

  if (ride.status !== RideStatus.MATCHED) {
    throw new AppError(400, "Ride must be locked before starting");
  }

  if (!ride.arrivedAt) {
    throw new AppError(400, "Driver must mark arrival before starting the ride");
  }

  if (ride.startedAt) {
    throw new AppError(400, "Ride already started");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.rideRequest.updateMany({
      where: {
        rideId,
        status: RequestStatus.MATCHED,
      },
      data: { status: RequestStatus.IN_PROGRESS },
    });

    return tx.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: rideInclude,
    });
  });

  return toRideResponse(updated);
}

export async function completeRide(driverId: string, rideId: string) {
  const ride = await getDriverRide(driverId, rideId);

  if (ride.status !== RideStatus.IN_PROGRESS) {
    throw new AppError(400, "Ride must be in progress before completing");
  }

  if (ride.completedAt) {
    throw new AppError(400, "Ride already completed");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.rideRequest.updateMany({
      where: {
        rideId,
        status: RequestStatus.IN_PROGRESS,
      },
      data: { status: RequestStatus.COMPLETED },
    });

    return tx.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: rideInclude,
    });
  });

  return toRideResponse(updated);
}
