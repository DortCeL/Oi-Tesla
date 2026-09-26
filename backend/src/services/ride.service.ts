import { RequestStatus, RideStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { toRideEventResponse } from "../utils/rideEventMapper.js";
import { toRideResponse } from "../utils/rideMapper.js";
import { recordRideEvent } from "./rideEvent.service.js";

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

export async function listDriverRides(driverId: string) {
  const rides = await prisma.ride.findMany({
    where: { driverId },
    include: rideInclude,
    orderBy: { createdAt: "desc" },
  });

  return rides.map(toRideResponse);
}

export async function getDriverRideDetail(driverId: string, rideId: string) {
  const ride = await getDriverRide(driverId, rideId);

  const events = await prisma.rideEvent.findMany({
    where: { rideId },
    orderBy: { createdAt: "asc" },
  });

  return {
    ride: toRideResponse(ride),
    events: events.map(toRideEventResponse),
  };
}

export async function markDriverArrival(driverId: string, rideId: string) {
  const ride = await getDriverRide(driverId, rideId);

  if (ride.status !== RideStatus.MATCHED) {
    throw new AppError(400, "Ride must be locked before marking arrival");
  }

  if (ride.arrivedAt) {
    throw new AppError(400, "Arrival already recorded");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await recordRideEvent(tx, {
      rideId,
      fromStatus: RideStatus.MATCHED,
      toStatus: RideStatus.MATCHED,
      actorUserId: driverId,
      note: "driver_arrived",
    });

    return tx.ride.update({
      where: { id: rideId },
      data: { arrivedAt: new Date() },
      include: rideInclude,
    });
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
    const matchedRequests = await tx.rideRequest.findMany({
      where: { rideId, status: RequestStatus.MATCHED },
      select: { id: true },
    });

    await tx.rideRequest.updateMany({
      where: { rideId, status: RequestStatus.MATCHED },
      data: { status: RequestStatus.IN_PROGRESS },
    });

    for (const request of matchedRequests) {
      await recordRideEvent(tx, {
        rideId,
        rideRequestId: request.id,
        fromStatus: RequestStatus.MATCHED,
        toStatus: RequestStatus.IN_PROGRESS,
        actorUserId: driverId,
      });
    }

    await recordRideEvent(tx, {
      rideId,
      fromStatus: RideStatus.MATCHED,
      toStatus: RideStatus.IN_PROGRESS,
      actorUserId: driverId,
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
    const activeRequests = await tx.rideRequest.findMany({
      where: { rideId, status: RequestStatus.IN_PROGRESS },
      select: { id: true },
    });

    await tx.rideRequest.updateMany({
      where: { rideId, status: RequestStatus.IN_PROGRESS },
      data: { status: RequestStatus.COMPLETED },
    });

    for (const request of activeRequests) {
      await recordRideEvent(tx, {
        rideId,
        rideRequestId: request.id,
        fromStatus: RequestStatus.IN_PROGRESS,
        toStatus: RequestStatus.COMPLETED,
        actorUserId: driverId,
      });
    }

    await recordRideEvent(tx, {
      rideId,
      fromStatus: RideStatus.IN_PROGRESS,
      toStatus: RideStatus.COMPLETED,
      actorUserId: driverId,
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
