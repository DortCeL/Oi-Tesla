import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { calculateFare } from "../utils/fare.js";
import type { RideRequestEstimateInput } from "../validators/rideRequest.validator.js";

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

export async function estimateRideRequestFare(input: RideRequestEstimateInput) {
  await assertZonesExist(input.pickupZoneId, input.destinationZoneId);
  const distanceM = await getZoneDistanceM(
    input.pickupZoneId,
    input.destinationZoneId,
  );

  return calculateFare(distanceM, input.type);
}
