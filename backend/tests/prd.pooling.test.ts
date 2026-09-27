import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupAllDemoRides,
  cleanupRides,
  acceptRideRequest,
  createAndAcceptRideRequest,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

describe("PRD pooling edge cases", () => {
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

  function trackRideId(rideId: string | null | undefined) {
    if (rideId) {
      trackedRideIds.add(rideId);
    }
  }

  it("pools when the new stop is closer and already on the way", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const gulshan = await getZoneId("Gulshan 1");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    // Gulshan first (farther), Mohakhali second (closer). Mohakhali is on the way.
    const firstRes = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(firstRes.status).toBe(201);
    trackRideId(firstRes.body.request.rideId);

    const secondRes = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.request.status).toBe("MATCHED");
    expect(secondRes.body.request.rideId).toBe(firstRes.body.request.rideId);
  });

  it("does not pool across different pickup zones", async () => {
    const banani = await getZoneId("Banani");
    const gulshan = await getZoneId("Gulshan 1");
    const mohakhali = await getZoneId("Mohakhali");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const firstRes = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(firstRes.status).toBe(201);
    trackRideId(firstRes.body.request.rideId);

    const secondRes = await createRideRequest(rafiqToken, {
      pickupZoneId: gulshan,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.request.status).toBe("REQUESTED");
    expect(secondRes.body.request.rideId).toBeNull();

    const acceptSecond = await acceptRideRequest(
      driverToken,
      secondRes.body.request.id as string,
    );
    expect(acceptSecond.status).toBe(400);
  });

  it("never joins an existing SHARED pool when booking SOLO", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const sharedRes = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(sharedRes.status).toBe(201);
    trackRideId(sharedRes.body.request.rideId);

    const soloRes = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SOLO",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(soloRes.status).toBe(201);
    expect(soloRes.body.request.status).toBe("REQUESTED");
    expect(soloRes.body.request.rideId).toBeNull();

    const acceptSolo = await acceptRideRequest(
      driverToken,
      soloRes.body.request.id as string,
    );
    expect(acceptSolo.status).toBe(400);
  });
});
