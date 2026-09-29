import type { Gender, PoolGenderPreference } from "@prisma/client";

export type GenderParty = {
  gender: Gender;
  poolGender: PoolGenderPreference;
};

/** A passenger may ask for anyone, or for their own gender only. */
export function preferenceMatchesOwnGender(
  gender: Gender,
  poolGender: PoolGenderPreference,
): boolean {
  if (poolGender === "ANY") return true;
  if (poolGender === "FEMALE_ONLY") return gender === "FEMALE";
  return gender === "MALE";
}

function allows(party: GenderParty, otherGender: Gender): boolean {
  if (party.poolGender === "ANY") return true;
  if (party.poolGender === "FEMALE_ONLY") return otherGender === "FEMALE";
  return otherGender === "MALE";
}

/** Both passengers must accept the other's gender. */
export function canSharePool(a: GenderParty, b: GenderParty): boolean {
  return allows(a, b.gender) && allows(b, a.gender);
}

export function canJoinPool(incoming: GenderParty, existing: GenderParty[]): boolean {
  return existing.every((mate) => canSharePool(incoming, mate));
}

/**
 * Split a FIFO list into groups where every member can share with every other.
 * The first request in each group is the anchor used as the stack key.
 */
export function groupCompatibleRequests<T>(
  requests: T[],
  partyOf: (request: T) => GenderParty,
): T[][] {
  const groups: T[][] = [];

  for (const request of requests) {
    const party = partyOf(request);
    const group = groups.find((existing) =>
      existing.every((member) => canSharePool(party, partyOf(member))),
    );

    if (group) {
      group.push(request);
    } else {
      groups.push([request]);
    }
  }

  return groups;
}

export function stackKey(
  pickupZoneId: number,
  destinationZoneId: number,
  type: string,
  anchorRequestId: string,
): string {
  return `${pickupZoneId}:${destinationZoneId}:${type}:${anchorRequestId}`;
}
