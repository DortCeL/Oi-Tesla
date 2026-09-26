import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prisma.js";
import {
  cleanupAllDemoRides,
  cleanupRides,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

/** PRD §1: Nusrat Banani→Mohakhali, then Rafiq Banani→Gulshan 1 share Bullet. */
describe("PRD rush-hour story", () => {
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

  it("pools Nusrat and Rafiq on one ride with PRD corridor fares", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const gulshan = await getZoneId("Gulshan 1");

    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const nusratRes = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(nusratRes.status).toBe(201);
    expect(nusratRes.body.request.farePaisa).toBe(4800);
    expect(nusratRes.body.request.status).toBe("MATCHED");

    const poolRideId = nusratRes.body.request.rideId as string;
    trackedRideIds.add(poolRideId);

    const rafiqRes = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(rafiqRes.status).toBe(201);
    expect(rafiqRes.body.request.farePaisa).toBe(7200);
    expect(rafiqRes.body.request.rideId).toBe(poolRideId);

    const poolRide = await prisma.ride.findUniqueOrThrow({
      where: { id: poolRideId },
    });
    expect(poolRide.seatsTaken).toBe(2);
    expect(poolRide.capacity).toBe(3);
    expect(poolRide.status).toBe("WAITING");
  });
});
