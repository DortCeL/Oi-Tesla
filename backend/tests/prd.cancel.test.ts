import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prisma.js";
import {
  cancelRideRequest,
  cleanupAllDemoRides,
  cleanupRides,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

describe("PRD cancellation rules", () => {
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

  it("allows cancel while the ride is still WAITING and frees the seat", async () => {
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
    const poolRideId = nusratRes.body.request.rideId as string;
    trackedRideIds.add(poolRideId);

    const rafiqRes = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    const rafiqRequestId = rafiqRes.body.request.id as string;

    const cancelRes = await cancelRideRequest(rafiqToken, rafiqRequestId);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.request.status).toBe("CANCELLED");
    expect(cancelRes.body.request.rideId).toBeNull();

    const poolRide = await prisma.ride.findUniqueOrThrow({
      where: { id: poolRideId },
    });
    expect(poolRide.seatsTaken).toBe(1);
    expect(poolRide.status).toBe("WAITING");
  });

  it("rejects cancel after the ride is locked (MATCHED)", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");

    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");

    const setupRes = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    trackedRideIds.add(setupRes.body.request.rideId);

    await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    const shirinRes = await createRideRequest(shirinToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    const shirinRequestId = shirinRes.body.request.id as string;

    const poolRide = await prisma.ride.findUniqueOrThrow({
      where: { id: shirinRes.body.request.rideId },
    });
    expect(poolRide.status).toBe("MATCHED");
    expect(poolRide.seatsTaken).toBe(3);

    const cancelRes = await cancelRideRequest(shirinToken, shirinRequestId);
    expect(cancelRes.status).toBe(400);
  });

  it("rejects cancel of another passenger's request", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");

    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const nusratRes = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    trackedRideIds.add(nusratRes.body.request.rideId);
    const nusratRequestId = nusratRes.body.request.id as string;

    const cancelRes = await cancelRideRequest(rafiqToken, nusratRequestId);
    expect(cancelRes.status).toBe(404);
  });
});
