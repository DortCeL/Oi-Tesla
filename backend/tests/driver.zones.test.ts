import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prisma.js";
import {
  acceptRideRequest,
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

  async function listRequests(token: string) {
    return request(app)
      .get("/api/driver/requests")
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

    const listed = await listRequests(driverToken);
    expect(listed.status).toBe(200);
    expect(listed.body.requests).toEqual([]);

    const accept = await acceptRideRequest(driverToken, res.body.request.id as string);
    expect(accept.status).toBe(400);
  });

  it("matches when the driver accepts a request in their pickup zone", async () => {
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
    expect(res.body.request.status).toBe("REQUESTED");

    const listed = await listRequests(driverToken);
    expect(listed.body.requests.map((row: { id: string }) => row.id)).toContain(
      res.body.request.id,
    );

    const accept = await acceptRideRequest(driverToken, res.body.request.id as string);
    expect(accept.status).toBe(200);
    expect(accept.body.request.status).toBe("MATCHED");
    expect(accept.body.request.rideId).toBeTruthy();
    trackedRideIds.add(accept.body.request.rideId);

    const ride = await prisma.ride.findUniqueOrThrow({
      where: { id: accept.body.request.rideId },
    });
    expect(ride.driverId).toBeTruthy();
    expect(ride.seatsTaken).toBeLessThanOrEqual(ride.capacity);
  });

  it("stays waiting on poll until the driver accepts", async () => {
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

    const stillWaiting = await pollRequest(nusratToken, requestId);
    expect(stillWaiting.body.request.status).toBe("REQUESTED");
    expect(stillWaiting.body.ride).toBeNull();

    const listed = await listRequests(driverToken);
    expect(listed.body.requests.map((row: { id: string }) => row.id)).toContain(requestId);

    const accept = await acceptRideRequest(driverToken, requestId);
    expect(accept.status).toBe(200);

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
    expect(res.body.request.status).toBe("REQUESTED");

    const accept = await acceptRideRequest(driverToken, res.body.request.id as string);
    expect(accept.status).toBe(200);
    expect(accept.body.request.status).toBe("MATCHED");
    trackedRideIds.add(accept.body.request.rideId);
  });
});
