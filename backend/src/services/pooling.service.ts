/**
 * Matches a passenger ride_request to a Tesla ride.
 *
 * Booking:
 *   SHARED → join an existing WAITING ride at the same pickup when it fits
 *   otherwise stay REQUESTED until a driver accepts
 * Accept:
 *   the driver starts a new ride on their Tesla (or joins an open shared pool)
 */
import {
  Prisma,
  RequestStatus,
  RideStatus,
  RideType,
  type RideRequest,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { recordRideEvent } from "./rideEvent.service.js";
import { toRideRequestResponse } from "../utils/rideRequestMapper.js";
import {
  hasEnoughSeats,
  isDestinationCompatible,
  type DistanceLookup,
} from "../utils/pooling.js";

/** Shape returned to the API after a successful match. */
const rideRequestInclude = {
  pickupZone: { select: { id: true, name: true } },
  destinationZone: { select: { id: true, name: true } },
} satisfies Prisma.RideRequestInclude;

/** Only the fields matching logic needs — not fare, payment, etc. */
type MatchableRequest = Pick<
  RideRequest,
  | "id"
  | "pickupZoneId"
  | "destinationZoneId"
  | "seatsRequested"
  | "type"
  | "status"
  | "rideId"
  | "passengerId"
>;

/** Turn zone_distance rows into dist(from, to) for in-memory checks. */
function buildDistanceLookup(
  rows: { fromZoneId: number; toZoneId: number; distanceM: number }[],
): DistanceLookup {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(`${row.fromZoneId}-${row.toZoneId}`, row.distanceM);
  }

  return (fromZoneId, toZoneId) => {
    if (fromZoneId === toZoneId) {
      return 0;
    }
    return map.get(`${fromZoneId}-${toZoneId}`) ?? null;
  };
}

/** Load all pairwise distances between the given zones (one query per candidate ride). */
async function loadDistanceLookup(
  tx: Prisma.TransactionClient,
  zoneIds: number[],
): Promise<DistanceLookup> {
  const uniqueZoneIds = [...new Set(zoneIds)];
  const rows = await tx.zoneDistance.findMany({
    where: {
      fromZoneId: { in: uniqueZoneIds },
      toZoneId: { in: uniqueZoneIds },
    },
    select: { fromZoneId: true, toZoneId: true, distanceM: true },
  });

  return buildDistanceLookup(rows);
}

/** SOLO locks on match; SHARED locks only when every seat is taken. */
function resolveRideStatusAfterAttach(
  type: RideType,
  capacity: number,
  seatsTaken: number,
): RideStatus {
  if (type === RideType.SOLO) {
    return RideStatus.MATCHED;
  }

  return seatsTaken >= capacity ? RideStatus.MATCHED : RideStatus.WAITING;
}

/** Flip ride WAITING → MATCHED when lock rules say the ride is sealed. */
async function maybeLockRide(
  tx: Prisma.TransactionClient,
  rideId: string,
  actorUserId: string,
  rideRequestId: string,
) {
  const ride = await tx.ride.findUnique({
    where: { id: rideId },
    select: { type: true, capacity: true, seatsTaken: true, status: true },
  });

  if (!ride || ride.status !== RideStatus.WAITING) {
    return;
  }

  const nextStatus = resolveRideStatusAfterAttach(
    ride.type,
    ride.capacity,
    ride.seatsTaken,
  );

  if (nextStatus !== ride.status) {
    await tx.ride.update({
      where: { id: rideId },
      data: { status: nextStatus },
    });

    await recordRideEvent(tx, {
      rideId,
      rideRequestId,
      fromStatus: RideStatus.WAITING,
      toStatus: RideStatus.MATCHED,
      actorUserId,
      note: "ride_locked",
    });
  }
}

/** Pool onto an existing ride: bump seatsTaken and link the request. */
async function attachRequestToRide(
  tx: Prisma.TransactionClient,
  request: MatchableRequest,
  rideId: string,
) {
  await tx.ride.update({
    where: { id: rideId },
    data: { seatsTaken: { increment: request.seatsRequested } },
  });

  await recordRideEvent(tx, {
    rideId,
    rideRequestId: request.id,
    fromStatus: RequestStatus.REQUESTED,
    toStatus: RequestStatus.MATCHED,
    actorUserId: request.passengerId,
  });

  await maybeLockRide(tx, rideId, request.passengerId, request.id);

  return tx.rideRequest.update({
    where: { id: request.id },
    data: {
      rideId,
      status: RequestStatus.MATCHED,
    },
    include: rideRequestInclude,
  });
}

/**
 * SHARED only: scan open rides at the same pickup and try to join one.
 * Returns null if no candidate fits — the request stays open for a driver to accept.
 */
async function tryJoinSharedRide(
  tx: Prisma.TransactionClient,
  request: MatchableRequest,
) {
  const candidates = await tx.ride.findMany({
    where: {
      pickupZoneId: request.pickupZoneId,
      type: RideType.SHARED,
      status: RideStatus.WAITING,
      driver: {
        isOnline: true,
        activeZoneIds: { has: request.pickupZoneId },
      },
      tesla: { isActive: true },
    },
    include: {
      requests: {
        where: { status: RequestStatus.MATCHED },
        select: { destinationZoneId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const candidate of candidates) {
    // --- Pre-lock checks (cheap; no row lock yet) ---

    if (
      !hasEnoughSeats(
        candidate.capacity,
        candidate.seatsTaken,
        request.seatsRequested,
      )
    ) {
      continue;
    }

    const zoneIds = [
      request.pickupZoneId,
      request.destinationZoneId,
      ...candidate.requests.map((r) => r.destinationZoneId),
    ];
    const dist = await loadDistanceLookup(tx, zoneIds);

    const existingDestinations = candidate.requests.map(
      (r) => r.destinationZoneId,
    );
    if (
      !isDestinationCompatible(
        dist,
        request.pickupZoneId,
        request.destinationZoneId,
        existingDestinations,
      )
    ) {
      continue;
    }

    // Lock this ride so two passengers can't grab the last seat at once.
    await tx.$queryRaw(
      Prisma.sql`SELECT 1 FROM rides WHERE id = ${candidate.id} FOR UPDATE`,
    );

    const lockedRide = await tx.ride.findUnique({
      where: { id: candidate.id },
      include: {
        requests: {
          where: { status: RequestStatus.MATCHED },
          select: { destinationZoneId: true },
        },
      },
    });

    if (!lockedRide) {
      continue;
    }

    // --- Post-lock checks (state may have changed while waiting for lock) ---

    if (
      !hasEnoughSeats(
        lockedRide.capacity,
        lockedRide.seatsTaken,
        request.seatsRequested,
      )
    ) {
      continue;
    }

    const lockedDestinations = lockedRide.requests.map(
      (r) => r.destinationZoneId,
    );
    if (
      !isDestinationCompatible(
        dist,
        request.pickupZoneId,
        request.destinationZoneId,
        lockedDestinations,
      )
    ) {
      continue;
    }

    return attachRequestToRide(tx, request, lockedRide.id);
  }

  return null;
}

const activeDriverRideStatuses: RideStatus[] = [
  RideStatus.WAITING,
  RideStatus.MATCHED,
  RideStatus.IN_PROGRESS,
];

/**
 * Automatic match only joins an open shared pool.
 * A new ride starts when a driver accepts the request.
 */
async function matchWithinTransaction(
  tx: Prisma.TransactionClient,
  request: MatchableRequest,
) {
  if (request.status !== RequestStatus.REQUESTED || request.rideId) {
    return null;
  }

  if (request.type !== RideType.SHARED) {
    return null;
  }

  return tryJoinSharedRide(tx, request);
}

/** Entry point: match one ride_request by id. Safe to call right after create. */
export async function tryMatchRideRequest(requestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.rideRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return null;
    }

    const matched = await matchWithinTransaction(tx, request);
    if (matched) {
      return matched;
    }

    // Still waiting for a driver to accept, or no open pool to join.
    return tx.rideRequest.findUnique({
      where: { id: requestId },
      include: rideRequestInclude,
    });
  });
}

/** Open REQUESTED bookings in the driver's active zones. */
export async function listOpenRideRequestsForDriver(driverId: string) {
  const driver = await prisma.driver.findUnique({
    where: { userId: driverId },
  });

  if (!driver || !driver.isOnline || driver.activeZoneIds.length === 0) {
    return [];
  }

  const requests = await prisma.rideRequest.findMany({
    where: {
      status: RequestStatus.REQUESTED,
      rideId: null,
      pickupZoneId: { in: driver.activeZoneIds },
    },
    include: {
      ...rideRequestInclude,
      passenger: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return requests.map((req) => ({
    ...toRideRequestResponse(req),
    passenger: { name: req.passenger.user.name },
  }));
}

/** Driver accepts a REQUESTED booking and starts a ride on their Tesla. */
export async function acceptRideRequest(driverId: string, requestId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT 1 FROM ride_requests WHERE id = ${requestId} FOR UPDATE`,
    );

    const request = await tx.rideRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError(404, "Ride request not found");
    }

    if (request.status !== RequestStatus.REQUESTED || request.rideId) {
      throw new AppError(400, "Ride request is no longer available");
    }

    if (request.type === RideType.SHARED) {
      const joined = await tryJoinSharedRide(tx, request);
      if (joined) {
        return toRideRequestResponse(joined);
      }
    }

    const accepted = await createRideOnDriver(tx, request, driverId);
    return toRideRequestResponse(accepted);
  });
}

async function createRideOnDriver(
  tx: Prisma.TransactionClient,
  request: MatchableRequest,
  driverId: string,
) {
  const driver = await tx.driver.findUnique({
    where: { userId: driverId },
    include: {
      teslas: {
        where: {
          isActive: true,
          capacity: { gte: request.seatsRequested },
        },
        orderBy: { capacity: "asc" },
        take: 1,
      },
    },
  });

  const tesla = driver?.teslas[0];
  if (!driver || !tesla) {
    throw new AppError(400, "No suitable Tesla available");
  }

  if (!driver.isOnline) {
    throw new AppError(400, "Go online before accepting requests");
  }

  if (!driver.activeZoneIds.includes(request.pickupZoneId)) {
    throw new AppError(400, "Pickup zone is outside your active zones");
  }

  const activeCount = await tx.ride.count({
    where: {
      driverId,
      status: { in: activeDriverRideStatuses },
    },
  });

  if (activeCount > 0) {
    throw new AppError(400, "Finish your current ride before accepting another");
  }

  const initialStatus = resolveRideStatusAfterAttach(
    request.type,
    tesla.capacity,
    request.seatsRequested,
  );

  const ride = await tx.ride.create({
    data: {
      teslaId: tesla.id,
      driverId: driver.userId,
      pickupZoneId: request.pickupZoneId,
      type: request.type,
      status: initialStatus,
      capacity: tesla.capacity,
      seatsTaken: request.seatsRequested,
    },
  });

  await recordRideEvent(tx, {
    rideId: ride.id,
    rideRequestId: request.id,
    fromStatus: "CREATED",
    toStatus: initialStatus,
    actorUserId: driverId,
    note: "driver_accepted",
  });

  await recordRideEvent(tx, {
    rideId: ride.id,
    rideRequestId: request.id,
    fromStatus: RequestStatus.REQUESTED,
    toStatus: RequestStatus.MATCHED,
    actorUserId: driverId,
  });

  return tx.rideRequest.update({
    where: { id: request.id },
    data: {
      rideId: ride.id,
      status: RequestStatus.MATCHED,
    },
    include: rideRequestInclude,
  });
}
