/**
 * Matches a passenger ride_request to a Tesla ride after booking.
 *
 * Flow (called from rideRequest.service after create):
 *   SOLO   → always start a new ride (never pool); ride locks immediately (MATCHED)
 *   SHARED → try join an existing WAITING ride at same pickup, else start new;
 *            ride locks (MATCHED) when seatsTaken === capacity
 *   no online driver → return unmatched (status stays REQUESTED)
 */
import {
  Prisma,
  RequestStatus,
  RideStatus,
  RideType,
  type RideRequest,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { recordRideEvent } from "./rideEvent.service.js";
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
 * Start a brand-new ride on the first online driver with a suitable Tesla.
 * Returns null when no driver is online — caller leaves request as REQUESTED.
 */
async function createRideAndAttach(
  tx: Prisma.TransactionClient,
  request: MatchableRequest,
) {
  const driver = await tx.driver.findFirst({
    where: {
      isOnline: true,
      activeZoneIds: { has: request.pickupZoneId },
      teslas: {
        some: {
          isActive: true,
          capacity: { gte: request.seatsRequested },
        },
      },
    },
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
    return null;
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
    actorUserId: request.passengerId,
  });

  await recordRideEvent(tx, {
    rideId: ride.id,
    rideRequestId: request.id,
    fromStatus: RequestStatus.REQUESTED,
    toStatus: RequestStatus.MATCHED,
    actorUserId: request.passengerId,
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

/**
 * SHARED only: scan open rides at the same pickup and try to join one.
 * Returns null if no candidate fits — caller should createRideAndAttach instead.
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

/** Pick SOLO vs SHARED strategy for one request inside a transaction. */
async function matchWithinTransaction(
  tx: Prisma.TransactionClient,
  request: MatchableRequest,
) {
  if (request.status !== RequestStatus.REQUESTED || request.rideId) {
    return null;
  }

  if (request.type === RideType.SOLO) {
    return createRideAndAttach(tx, request);
  }

  const joined = await tryJoinSharedRide(tx, request);
  if (joined) {
    return joined;
  }

  return createRideAndAttach(tx, request);
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

    // No online driver or match failed — return request still REQUESTED.
    return tx.rideRequest.findUnique({
      where: { id: requestId },
      include: rideRequestInclude,
    });
  });
}
