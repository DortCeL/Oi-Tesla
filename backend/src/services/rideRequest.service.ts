import { Prisma, RequestStatus, RideStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { calculateFare } from "../utils/fare.js";
import { recordRideEvent } from "./rideEvent.service.js";
import { tryMatchRideRequest } from "./pooling.service.js";
import { toRideRequestResponse } from "../utils/rideRequestMapper.js";
import type {
  RideRequestCreateInput,
  RideRequestEstimateInput,
} from "../validators/rideRequest.validator.js";

const rideRequestInclude = {
  pickupZone: { select: { id: true, name: true } },
  destinationZone: { select: { id: true, name: true } },
} satisfies Prisma.RideRequestInclude;

async function getZoneDistanceM(fromZoneId: number, toZoneId: number) {
  const row = await prisma.zoneDistance.findUnique({
    where: {
      fromZoneId_toZoneId: { fromZoneId, toZoneId },
    },
  });

  if (!row) {
    throw new AppError(400, "No route distance found between these zones");
  }

  return row.distanceM;
}

async function assertZonesExist(pickupZoneId: number, destinationZoneId: number) {
  const zones = await prisma.zone.findMany({
    where: { id: { in: [pickupZoneId, destinationZoneId] } },
    select: { id: true },
  });

  if (zones.length !== 2) {
    throw new AppError(400, "Invalid pickup or destination zone");
  }
}

async function resolveFare(input: RideRequestEstimateInput) {
  await assertZonesExist(input.pickupZoneId, input.destinationZoneId);
  const distanceM = await getZoneDistanceM(
    input.pickupZoneId,
    input.destinationZoneId,
  );

  return calculateFare(distanceM, input.type);
}

export async function estimateRideRequestFare(input: RideRequestEstimateInput) {
  return resolveFare(input);
}

export async function createRideRequest(
  passengerId: string,
  input: RideRequestCreateInput,
) {
  const passenger = await prisma.passenger.findUnique({
    where: { userId: passengerId },
  });

  if (!passenger) {
    throw new AppError(404, "Passenger not found");
  }

  const fare = await resolveFare(input);

  const request = await prisma.rideRequest.create({
    data: {
      passengerId,
      pickupZoneId: input.pickupZoneId,
      destinationZoneId: input.destinationZoneId,
      seatsRequested: input.seatsRequested,
      type: input.type,
      paymentMethod: input.paymentMethod,
      baseFarePaisa: fare.baseFarePaisa,
      distanceChargePaisa: fare.distanceChargePaisa,
      poolDiscountPaisa: fare.poolDiscountPaisa,
      farePaisa: fare.farePaisa,
    },
  });

  const matched = await tryMatchRideRequest(request.id);
  const finalRequest =
    matched ??
    (await prisma.rideRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: rideRequestInclude,
    }));

  return toRideRequestResponse(finalRequest);
}

export async function listPassengerRideRequests(passengerId: string) {
  const requests = await prisma.rideRequest.findMany({
    where: { passengerId },
    include: rideRequestInclude,
    orderBy: { createdAt: "desc" },
  });

  return requests.map(toRideRequestResponse);
}

export async function cancelRideRequest(passengerId: string, requestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.rideRequest.findUnique({
      where: { id: requestId },
      include: {
        ride: { select: { id: true, status: true } },
      },
    });

    if (!request || request.passengerId !== passengerId) {
      throw new AppError(404, "Ride request not found");
    }

    if (request.status === RequestStatus.CANCELLED) {
      throw new AppError(400, "Ride request already cancelled");
    }

    if (
      request.status === RequestStatus.IN_PROGRESS ||
      request.status === RequestStatus.COMPLETED
    ) {
      throw new AppError(400, "Cannot cancel ride request in current status");
    }

    if (request.rideId && request.ride) {
      if (request.ride.status !== RideStatus.WAITING) {
        throw new AppError(400, "Cannot cancel after ride is locked");
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM rides WHERE id = ${request.rideId} FOR UPDATE`,
      );

      const ride = await tx.ride.findUnique({
        where: { id: request.rideId },
        select: { status: true },
      });

      if (!ride || ride.status !== RideStatus.WAITING) {
        throw new AppError(400, "Cannot cancel after ride is locked");
      }

      await tx.ride.update({
        where: { id: request.rideId },
        data: { seatsTaken: { decrement: request.seatsRequested } },
      });
    }

    const previousStatus = request.status;
    const rideIdForEvent = request.rideId;

    const cancelled = await tx.rideRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.CANCELLED,
        cancelledAt: new Date(),
        rideId: null,
      },
      include: rideRequestInclude,
    });

    if (rideIdForEvent) {
      await recordRideEvent(tx, {
        rideId: rideIdForEvent,
        rideRequestId: requestId,
        fromStatus: previousStatus,
        toStatus: RequestStatus.CANCELLED,
        actorUserId: passengerId,
      });
    }

    return toRideRequestResponse(cancelled);
  });
}
