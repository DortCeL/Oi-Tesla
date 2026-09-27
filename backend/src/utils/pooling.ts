/** dist(from, to) in meters, or null if not in zone_distances. */
export type DistanceLookup = (fromZoneId: number, toZoneId: number) => number | null;

export function hasEnoughSeats(  capacity: number,
  seatsTaken: number,
  seatsRequested: number,
): boolean {
  return capacity - seatsTaken >= seatsRequested;
}

/**
 * True when A and B lie on the same road from pickup.
 * Either stop can be on the way to the other, so booking order does not matter.
 */
export function areOnSameCorridor(
  dist: DistanceLookup,
  pickupZoneId: number,
  destinationA: number,
  destinationB: number,
): boolean {
  if (destinationA === destinationB) {
    return true;
  }

  const pickupToA = dist(pickupZoneId, destinationA);
  const pickupToB = dist(pickupZoneId, destinationB);
  const aToB = dist(destinationA, destinationB);

  if (pickupToA === null || pickupToB === null || aToB === null) {
    return false;
  }

  return pickupToA + aToB <= pickupToB || pickupToB + aToB <= pickupToA;
}

/**
 * True when the new stop shares a corridor with every destination already on the ride.
 *
 * Example: Gulshan 1 is accepted first, then Mohakhali still joins, because
 * Mohakhali sits on the Banani → Gulshan 1 road.
 */
export function isDestinationCompatible(
  dist: DistanceLookup,
  pickupZoneId: number,
  newDestinationZoneId: number,
  existingDestinationZoneIds: number[],
): boolean {
  if (existingDestinationZoneIds.length === 0) {
    return true;
  }

  for (const existingDestinationZoneId of existingDestinationZoneIds) {
    if (
      !areOnSameCorridor(
        dist,
        pickupZoneId,
        newDestinationZoneId,
        existingDestinationZoneId,
      )
    ) {
      return false;
    }
  }

  return true;
}
