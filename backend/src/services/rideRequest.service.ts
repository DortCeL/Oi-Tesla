import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { calculateFare } from "../utils/fare.js";
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
    include: rideRequestInclude,
  });

  return toRideRequestResponse(request);
}
