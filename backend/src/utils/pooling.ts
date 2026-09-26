/** dist(from, to) in meters, or null if not in zone_distances. */
export type DistanceLookup = (fromZoneId: number, toZoneId: number) => number | null;

export function hasEnoughSeats(  capacity: number,
  seatsTaken: number,
  seatsRequested: number,
): boolean {
  return capacity - seatsTaken >= seatsRequested;
}

/**
 * True when newDest fits the ride without a detour.
 *
 * For each passenger already on the ride, the new stop must lie on the same
 * corridor: dist(pickup, existing) + dist(existing, new) <= dist(pickup, new).
 *
 * Example: Nusrat Banani→Mohakhali first, then Rafiq Banani→Gulshan can join
 * if Mohakhali is on the way to Gulshan. The reverse order may fail.
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

  const pickupToNew = dist(pickupZoneId, newDestinationZoneId);
  if (pickupToNew === null) {
    return false;
  }

  for (const existingDestinationZoneId of existingDestinationZoneIds) {
    const pickupToExisting = dist(pickupZoneId, existingDestinationZoneId);
    const existingToNew = dist(existingDestinationZoneId, newDestinationZoneId);

    if (pickupToExisting === null || existingToNew === null) {
      return false;
    }

    // Detour would make the via-route longer than going direct to new.
    if (pickupToExisting + existingToNew > pickupToNew) {
      return false;
    }
  }

  return true;
}
