import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prisma.js";
import {
  cleanupAllDemoRides,
  cleanupRides,
  createAndAcceptRideRequest,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

/**
 * PRD scenario: Bullet has 1 seat left. Nusrat and Shirin both try to claim it
 * at nearly the same instant. Capacity must never be exceeded.
 */
describe("concurrent last-seat pool claim", () => {
  const trackedRideIds = new Set<string>();

  beforeEach(async () => {
    await cleanupAllDemoRides();
    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, true);
  });

  afterEach(async () => {
    await cleanupRides([...trackedRideIds]);
    trackedRideIds.clear();
  });

  it("never exceeds Bullet capacity when two passengers race for the last seat", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");

    const driverToken = await login("jashim@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");

    // Fill Bullet to 2/3: one SHARED party of two (Rafiq + friend equivalent).
    const setupRes = await createAndAcceptRideRequest(rafiqToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 2,
      paymentMethod: "CASH",
    });

    expect(setupRes.status).toBe(201);
    const poolRideId = setupRes.body.request.rideId as string;
    expect(poolRideId).toBeTruthy();
    trackedRideIds.add(poolRideId);

    const rideBeforeRace = await prisma.ride.findUniqueOrThrow({
      where: { id: poolRideId },
    });
    expect(rideBeforeRace.seatsTaken).toBe(2);
    expect(rideBeforeRace.capacity).toBe(3);
    expect(rideBeforeRace.status).toBe("WAITING");

    // Both racers must be pool-eligible (same corridor) so they contend for
    // the same WAITING ride and exercise SELECT … FOR UPDATE.
    const [nusratRes, shirinRes] = await Promise.all([
      createRideRequest(nusratToken, {
        pickupZoneId: banani,
        destinationZoneId: mohakhali,
        type: "SHARED",
        seatsRequested: 1,
        paymentMethod: "CASH",
      }),
      createRideRequest(shirinToken, {
        pickupZoneId: banani,
        destinationZoneId: mohakhali,
        type: "SHARED",
        seatsRequested: 1,
        paymentMethod: "CASH",
      }),
    ]);

    expect(nusratRes.status).toBe(201);
    expect(shirinRes.status).toBe(201);

    const nusratRideId = nusratRes.body.request.rideId as string | null;
    const shirinRideId = shirinRes.body.request.rideId as string | null;
    if (nusratRideId) trackedRideIds.add(nusratRideId);
    if (shirinRideId) trackedRideIds.add(shirinRideId);

    const poolRideAfter = await prisma.ride.findUniqueOrThrow({
      where: { id: poolRideId },
      include: { requests: { where: { status: { not: "CANCELLED" } } } },
    });

    // Core invariant: capacity is never exceeded on any ride.
    const allRides = await prisma.ride.findMany({
      where: { id: { in: [...trackedRideIds] } },
    });
    for (const ride of allRides) {
      expect(ride.seatsTaken).toBeLessThanOrEqual(ride.capacity);
    }

    // Exactly one of the two racers should have won the last seat on the pool ride.
    const racersOnPool = [nusratRideId, shirinRideId].filter(
      (id) => id === poolRideId,
    ).length;
    expect(racersOnPool).toBe(1);

    // Pool ride should be full and locked after the winner joins.
    expect(poolRideAfter.seatsTaken).toBe(3);
    expect(poolRideAfter.status).toBe("MATCHED");

    // Loser stays waiting. Accepting would start a second ride, which is not allowed.
    const loserRideId = nusratRideId === poolRideId ? shirinRideId : nusratRideId;
    expect(loserRideId).not.toBe(poolRideId);

    // Winner is MATCHED on the pool ride.
    const winnerRequest =
      nusratRideId === poolRideId ? nusratRes.body.request : shirinRes.body.request;
    expect(winnerRequest.status).toBe("MATCHED");
    expect(winnerRequest.rideId).toBe(poolRideId);
  });
});
