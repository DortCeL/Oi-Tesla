import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prisma.js";
import {
  app,
  cleanupAllDemoRides,
  cleanupRides,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";
import request from "supertest";

describe("driver active zone matching", () => {
  const trackedRideIds = new Set<string>();

  beforeEach(async () => {
    await cleanupAllDemoRides();
    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, false);
  });

  afterEach(async () => {
    await cleanupRides([...trackedRideIds]);
    trackedRideIds.clear();
  });

  async function pollRequest(token: string, requestId: string) {
    return request(app)
      .get(`/api/ride-requests/${requestId}`)
      .set("Authorization", `Bearer ${token}`);
  }

  it("does not match when driver is online in a different zone", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const gulshan = await getZoneId("Gulshan 1");

    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, true, [gulshan]);

    const nusratToken = await login("nusrat@oitesla.test");
    const res = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("REQUESTED");
    expect(res.body.request.rideId).toBeNull();
  });

  it("matches when driver is online in the passenger pickup zone", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");

    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, true, [banani]);

    const nusratToken = await login("nusrat@oitesla.test");
    const res = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("MATCHED");
    expect(res.body.request.rideId).toBeTruthy();
    trackedRideIds.add(res.body.request.rideId);

    const ride = await prisma.ride.findUniqueOrThrow({
      where: { id: res.body.request.rideId },
    });
    expect(ride.driverId).toBeTruthy();
    expect(ride.seatsTaken).toBeLessThanOrEqual(ride.capacity);
  });

  it("matches via poll when driver goes online in the pickup zone after booking", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const gulshan = await getZoneId("Gulshan 1");

    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, true, [gulshan]);

    const nusratToken = await login("nusrat@oitesla.test");
    const bookRes = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(bookRes.status).toBe(201);
    const requestId = bookRes.body.request.id as string;

    const waitingPoll = await pollRequest(nusratToken, requestId);
    expect(waitingPoll.status).toBe(200);
    expect(waitingPoll.body.request.status).toBe("REQUESTED");
    expect(waitingPoll.body.ride).toBeNull();

    await setDriverOnline(driverToken, true, [banani, gulshan]);

    const matchedPoll = await pollRequest(nusratToken, requestId);
    expect(matchedPoll.status).toBe(200);
    expect(matchedPoll.body.request.status).toBe("MATCHED");
    expect(matchedPoll.body.request.rideId).toBeTruthy();
    expect(matchedPoll.body.driver?.name).toBe("Jashim");
    trackedRideIds.add(matchedPoll.body.request.rideId);
  });

  it("matches when pickup zone is one of several active driver zones", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const gulshan = await getZoneId("Gulshan 1");

    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, true, [banani, gulshan]);

    const nusratToken = await login("nusrat@oitesla.test");
    const res = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("MATCHED");
    trackedRideIds.add(res.body.request.rideId);
  });
});
