import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  acceptRideRequest,
  app,
  cancelRideRequest,
  cleanupAllDemoRides,
  cleanupRides,
  createAndAcceptRideRequest,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

describe("driver offline queue", () => {
  const trackedRideIds = new Set<string>();

  beforeEach(async () => {
    await cleanupAllDemoRides();
  });

  afterEach(async () => {
    await cleanupRides([...trackedRideIds]);
    trackedRideIds.clear();
    await cleanupAllDemoRides();
  });

  it("finishes the current pool, then goes offline and refuses a new ride", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const mirpur = await getZoneId("Mirpur");
    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");
    await setDriverOnline(driverToken, true);

    const booked = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    const rideId = booked.body.request.rideId as string;
    trackedRideIds.add(rideId);

    const queued = await request(app)
      .patch("/api/driver/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ isOnline: false });
    expect(queued.status).toBe(200);
    expect(queued.body.user.driver.isOnline).toBe(true);
    expect(queued.body.user.driver.offlineQueued).toBe(true);

    const joined = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(joined.status).toBe(201);
    expect(joined.body.request.rideId).toBe(rideId);

    const solo = await createRideRequest(shirinToken, {
      pickupZoneId: banani,
      destinationZoneId: mirpur,
      type: "SOLO",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(solo.status).toBe(201);
    const declined = await acceptRideRequest(driverToken, solo.body.request.id as string);
    expect(declined.status).toBe(400);
    expect(declined.body.error).toBe("Cannot start a new ride while going offline");

    expect((await cancelRideRequest(rafiqToken, joined.body.request.id as string)).status).toBe(200);
    const stillOn = await request(app)
      .get("/api/auth/driver/me")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(stillOn.body.user.driver.isOnline).toBe(true);
    expect(stillOn.body.user.driver.offlineQueued).toBe(true);

    expect(
      (await cancelRideRequest(nusratToken, booked.body.request.id as string)).status,
    ).toBe(200);

    const me = await request(app)
      .get("/api/auth/driver/me")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(me.body.user.driver.isOnline).toBe(false);
    expect(me.body.user.driver.offlineQueued).toBe(false);
    expect(me.body.user.driver.activeZoneIds).toEqual([]);
  });

  it("lets the driver stay online and clear the queue", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    await setDriverOnline(driverToken, true);

    const booked = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    trackedRideIds.add(booked.body.request.rideId as string);

    await request(app)
      .patch("/api/driver/status")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ isOnline: false });

    const stayed = await request(app)
      .post("/api/driver/status/stay-online")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(stayed.status).toBe(200);
    expect(stayed.body.user.driver.isOnline).toBe(true);
    expect(stayed.body.user.driver.offlineQueued).toBe(false);
  });
});
