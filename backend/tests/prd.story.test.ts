import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/db/prisma.js";
import {
  app,
  cleanupAllDemoRides,
  cleanupRides,
  createAndAcceptRideRequest,
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

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const nusratRes = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(nusratRes.status).toBe(201);
    expect(nusratRes.body.request.farePaisa).toBe(2400);
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
    expect(rafiqRes.body.request.farePaisa).toBe(3600);
    expect(rafiqRes.body.request.rideId).toBe(poolRideId);

    const poolRide = await prisma.ride.findUniqueOrThrow({
      where: { id: poolRideId },
    });
    expect(poolRide.seatsTaken).toBe(2);
    expect(poolRide.capacity).toBe(3);
    expect(poolRide.status).toBe("WAITING");

    const ridesRes = await request(app)
      .get("/api/driver/rides")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(ridesRes.status).toBe(200);
    const driverRide = ridesRes.body.rides.find(
      (ride: { id: string }) => ride.id === poolRideId,
    );
    expect(driverRide.totalFarePaisa).toBe(6000);
    expect(driverRide.passengers).toEqual([
      { name: "Nusrat", farePaisa: 2400 },
      { name: "Rafiq", farePaisa: 3600 },
    ]);
  });

  it("doubles a shared fare for two seats and keeps a reserved ride at one price", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const shared = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 2,
      paymentMethod: "CASH",
    });
    expect(shared.status).toBe(201);
    expect(shared.body.request.farePaisa).toBe(4800);
    expect(shared.body.request.poolDiscountPaisa).toBe(7200);

    const solo = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SOLO",
      seatsRequested: 2,
      paymentMethod: "CASH",
    });
    expect(solo.status).toBe(201);
    expect(solo.body.request.farePaisa).toBe(6000);
    expect(solo.body.request.poolDiscountPaisa).toBe(0);
  });
});
