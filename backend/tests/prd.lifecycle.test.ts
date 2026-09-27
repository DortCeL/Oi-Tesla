import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/db/prisma.js";
import {
  app,
  cleanupAllDemoRides,
  cleanupRides,
  createAndAcceptRideRequest,
  createRideRequest,
  driverArrive,
  driverComplete,
  driverStart,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

describe("PRD driver lifecycle", () => {
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

  async function createLockedPoolRide() {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");

    await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
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

    const rideId = shirinRes.body.request.rideId as string;
    trackedRideIds.add(rideId);
    return { rideId, driverToken: await login("jashim@oitesla.test") };
  }

  it("runs arrive → start → complete and updates all request statuses", async () => {
    const { rideId, driverToken } = await createLockedPoolRide();

    const arriveRes = await driverArrive(driverToken, rideId);
    expect(arriveRes.status).toBe(200);
    expect(arriveRes.body.ride.passengers).toHaveLength(3);
    expect(arriveRes.body.ride.totalFarePaisa).toBe(2400 * 3);
    expect(arriveRes.body.ride.passengers[0]).toEqual({
      name: expect.any(String),
      farePaisa: 2400,
    });
    expect((await driverStart(driverToken, rideId)).status).toBe(200);
    expect((await driverComplete(driverToken, rideId)).status).toBe(200);

    const ride = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(ride.status).toBe("COMPLETED");
    expect(ride.arrivedAt).not.toBeNull();
    expect(ride.startedAt).not.toBeNull();
    expect(ride.completedAt).not.toBeNull();

    const requests = await prisma.rideRequest.findMany({ where: { rideId } });
    expect(requests).toHaveLength(3);
    for (const req of requests) {
      expect(req.status).toBe("COMPLETED");
    }

    const history = await request(app)
      .get("/api/driver/rides/history")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(history.status).toBe(200);
    expect(history.body.rides).toEqual([
      expect.objectContaining({
        id: rideId,
        status: "COMPLETED",
        totalFarePaisa: 7200,
        passengers: [
          { name: "Nusrat", farePaisa: 2400 },
          { name: "Rafiq", farePaisa: 2400 },
          { name: "Shirin", farePaisa: 2400 },
        ],
      }),
    ]);
  });

  it("rejects start before driver marks arrival", async () => {
    const { rideId, driverToken } = await createLockedPoolRide();

    const startRes = await driverStart(driverToken, rideId);
    expect(startRes.status).toBe(400);
  });

  it("rejects complete before the ride has started", async () => {
    const { rideId, driverToken } = await createLockedPoolRide();

    expect((await driverArrive(driverToken, rideId)).status).toBe(200);

    const completeRes = await driverComplete(driverToken, rideId);
    expect(completeRes.status).toBe(400);
  });

  it("rejects arrival while the ride is still WAITING (not locked)", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");

    const nusratRes = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    const rideId = nusratRes.body.request.rideId as string;
    trackedRideIds.add(rideId);

    const arriveRes = await driverArrive(driverToken, rideId);
    expect(arriveRes.status).toBe(400);
  });
});
