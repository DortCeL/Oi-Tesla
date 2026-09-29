/**
 * Matches a passenger ride_request to a Tesla ride.
 *
 * Booking:
 *   SHARED → join an existing WAITING ride at the same pickup when it fits
 *   otherwise stay REQUESTED until a driver accepts
 *   a women-only or men-only booking only joins a pool where every passenger agrees
 * Accept:
 *   the driver starts a new ride on their Tesla (or joins an open shared pool)
 *   same pickup, destination, and type stack together; one accept takes who fits
 *   gender-restricted bookings on the same route stay in separate stacks
 */
import {
  Prisma,
  RequestStatus,
  RideStatus,
  RideType,
  type Gender,
  type PoolGenderPreference,
  type RideRequest,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { recordRideEvent } from "./rideEvent.service.js";
import { toRideRequestResponse } from "../utils/rideRequestMapper.js";
import {
  canJoinPool,
  groupCompatibleRequests,
  stackKey,
  type GenderParty,
} from "../utils/poolGender.js";
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
  | "poolGender"
  | "status"
  | "rideId"
  | "passengerId"
>;

const mateGenderSelect = {
  destinationZoneId: true,
  poolGender: true,
  passenger: {
    select: { user: { select: { gender: true } } },
  },
} as const;

function partyOf(request: {
  poolGender: PoolGenderPreference;
  passenger: { user: { gender: Gender } };
}): GenderParty {
  return {
    gender: request.passenger.user.gender,
    poolGender: request.poolGender,
  };
}

async function loadPassengerGender(
  tx: Prisma.TransactionClient,
  passengerId: string,
): Promise<Gender> {
  const user = await tx.user.findUnique({
    where: { id: passengerId },
    select: { gender: true },
  });

  if (!user) {
    throw new AppError(404, "Passenger not found");
  }

  return user.gender;
}

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
  const incomingGender = await loadPassengerGender(tx, request.passengerId);
  const incomingParty: GenderParty = {
    gender: incomingGender,
    poolGender: request.poolGender,
  };

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
        select: mateGenderSelect,
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

    if (!canJoinPool(incomingParty, candidate.requests.map(partyOf))) {
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
          select: mateGenderSelect,
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

    if (!canJoinPool(incomingParty, lockedRide.requests.map(partyOf))) {
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

/**
 * Pick which open requests fit on the Tesla when accepting a stack (FIFO).
 * SOLO takes only the earliest request. SHARED packs until the seats are full.
 */
function selectFitRequests<
  T extends { id: string; seatsRequested: number; farePaisa: number },
>(type: RideType, capacity: number, ordered: T[]): T[] {
  if (ordered.length === 0 || capacity <= 0) {
    return [];
  }

  if (type === RideType.SOLO) {
    return [ordered[0]];
  }

  const fit: T[] = [];
  let seatsTaken = 0;
  for (const req of ordered) {
    if (!hasEnoughSeats(capacity, seatsTaken, req.seatsRequested)) {
      continue;
    }
    fit.push(req);
    seatsTaken += req.seatsRequested;
    if (seatsTaken >= capacity) {
      break;
    }
  }
  return fit;
}

/** Open REQUESTED bookings grouped by pickup, destination, and ride type. */
export async function listOpenRequestStacksForDriver(driverId: string) {
  const driver = await prisma.driver.findUnique({
    where: { userId: driverId },
    include: {
      teslas: {
        where: { isActive: true },
        orderBy: { capacity: "asc" },
        take: 1,
      },
    },
  });

  if (!driver || !driver.isOnline || driver.activeZoneIds.length === 0) {
    return [];
  }

  const capacity = driver.teslas[0]?.capacity ?? 0;
  if (capacity === 0) {
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
        include: { user: { select: { name: true, gender: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  type StackBucket = {
    pickupZone: { id: number; name: string };
    destinationZone: { id: number; name: string };
    type: RideType;
    requests: typeof requests;
  };

  const buckets = new Map<string, StackBucket>();
  for (const req of requests) {
    const key = `${req.pickupZoneId}:${req.destinationZoneId}:${req.type}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.requests.push(req);
    } else {
      buckets.set(key, {
        pickupZone: req.pickupZone,
        destinationZone: req.destinationZone,
        type: req.type,
        requests: [req],
      });
    }
  }

  const stacks = [...buckets.values()].flatMap((bucket) => {
    const groups =
      bucket.type === RideType.SHARED
        ? groupCompatibleRequests(bucket.requests, partyOf)
        : [bucket.requests];

    return groups.map((group) => {
      const passengers = group.map((req) => ({
        requestId: req.id,
        name: req.passenger.user.name,
        farePaisa: req.farePaisa,
        seatsRequested: req.seatsRequested,
      }));

      const fit = selectFitRequests(
        bucket.type,
        capacity,
        group.map((req) => ({
          id: req.id,
          seatsRequested: req.seatsRequested,
          farePaisa: req.farePaisa,
        })),
      );

      const waitingSeats = group.reduce((sum, req) => sum + req.seatsRequested, 0);

      return {
        key: stackKey(
          bucket.pickupZone.id,
          bucket.destinationZone.id,
          bucket.type,
          group[0].id,
        ),
        pickupZone: bucket.pickupZone,
        destinationZone: bucket.destinationZone,
        type: bucket.type,
        capacity,
        waitingCount: group.length,
        waitingSeats,
        passengers,
        acceptCount: fit.length,
        acceptSeats: fit.reduce((sum, req) => sum + req.seatsRequested, 0),
        totalFarePaisa: fit.reduce((sum, req) => sum + req.farePaisa, 0),
        acceptRequestIds: fit.map((req) => req.id),
      };
    });
  });

  stacks.sort((a, b) => b.totalFarePaisa - a.totalFarePaisa);
  return stacks;
}

export type AcceptStackInput = {
  pickupZoneId: number;
  destinationZoneId: number;
  type: RideType;
  stackKey?: string;
};

/** Accept one stack: start a ride and match every request that fits. */
export async function acceptRequestStack(driverId: string, input: AcceptStackInput) {
  return prisma.$transaction(async (tx) => {
    const driver = await tx.driver.findUnique({
      where: { userId: driverId },
      include: {
        teslas: {
          where: { isActive: true },
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
    if (driver.offlineQueued) {
      throw new AppError(400, "Cannot start a new ride while going offline");
    }
    if (!driver.activeZoneIds.includes(input.pickupZoneId)) {
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

    const genderInclude = {
      passenger: {
        include: { user: { select: { gender: true } } },
      },
    } satisfies Prisma.RideRequestInclude;

    const open = await tx.rideRequest.findMany({
      where: {
        status: RequestStatus.REQUESTED,
        rideId: null,
        pickupZoneId: input.pickupZoneId,
        destinationZoneId: input.destinationZoneId,
        type: input.type,
      },
      include: genderInclude,
      orderBy: { createdAt: "asc" },
    });

    if (open.length === 0) {
      throw new AppError(400, "No open requests on this route");
    }

    await tx.$queryRaw`
      SELECT id FROM ride_requests
      WHERE id IN (${Prisma.join(open.map((req) => req.id))})
      FOR UPDATE
    `;

    const locked = await tx.rideRequest.findMany({
      where: {
        id: { in: open.map((req) => req.id) },
        status: RequestStatus.REQUESTED,
        rideId: null,
      },
      include: genderInclude,
      orderBy: { createdAt: "asc" },
    });

    if (locked.length === 0) {
      throw new AppError(400, "No open requests on this route");
    }

    const groups =
      input.type === RideType.SHARED
        ? groupCompatibleRequests(locked, partyOf)
        : [locked];
    const chosen = input.stackKey
      ? groups.find(
          (group) =>
            stackKey(
              input.pickupZoneId,
              input.destinationZoneId,
              input.type,
              group[0].id,
            ) === input.stackKey,
        )
      : groups[0];

    if (!chosen) {
      throw new AppError(400, "That pool is no longer available");
    }

    const fit = selectFitRequests(
      input.type,
      tesla.capacity,
      chosen.map((req) => ({
        id: req.id,
        seatsRequested: req.seatsRequested,
        farePaisa: req.farePaisa,
      })),
    );

    if (fit.length === 0) {
      throw new AppError(400, "No requests fit your Tesla capacity");
    }

    const byId = new Map(locked.map((req) => [req.id, req]));
    const first = byId.get(fit[0].id);
    if (!first) {
      throw new AppError(400, "No open requests on this route");
    }

    const acceptedFirst = await createRideOnDriver(tx, first, driverId);
    const rideId = acceptedFirst.rideId;
    if (!rideId) {
      throw new AppError(500, "Ride was not created");
    }

    for (const next of fit.slice(1)) {
      const req = byId.get(next.id);
      if (!req) continue;
      const fresh = await tx.rideRequest.findUnique({ where: { id: req.id } });
      if (!fresh || fresh.status !== RequestStatus.REQUESTED || fresh.rideId) {
        continue;
      }
      await attachRequestToRide(tx, fresh, rideId);
    }

    const matched = await tx.rideRequest.findMany({
      where: { id: { in: fit.map((item) => item.id) }, rideId },
      include: rideRequestInclude,
      orderBy: { createdAt: "asc" },
    });

    return {
      requests: matched.map(toRideRequestResponse),
      rideId,
      totalFarePaisa: matched.reduce((sum, req) => sum + req.farePaisa, 0),
    };
  });
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

  if (driver.offlineQueued) {
    throw new AppError(400, "Cannot start a new ride while going offline");
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
