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

describe("shared pool gender preference", () => {
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

  it("lets a woman join a women-only pool and keeps a man out", async () => {
    const banani = await getZoneId("Banani");
    const gulshan = await getZoneId("Gulshan 1");
    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const nusrat = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
      poolGender: "FEMALE_ONLY",
    });
    expect(nusrat.status).toBe(201);
    const rideId = nusrat.body.request.rideId as string;
    trackedRideIds.add(rideId);

    const shirin = await createRideRequest(shirinToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(shirin.status).toBe(201);
    expect(shirin.body.request.rideId).toBe(rideId);

    const rafiq = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(rafiq.status).toBe(201);
    expect(rafiq.body.request.rideId).toBeNull();
    expect(rafiq.body.request.status).toBe("REQUESTED");

    const ride = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(ride.seatsTaken).toBe(2);
  });

  it("does not let a women-only passenger join a pool that already has a man", async () => {
    const banani = await getZoneId("Banani");
    const gulshan = await getZoneId("Gulshan 1");
    const driverToken = await login("jashim@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");

    const rafiq = await createAndAcceptRideRequest(rafiqToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    const rideId = rafiq.body.request.rideId as string;
    trackedRideIds.add(rideId);

    const nusrat = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
      poolGender: "FEMALE_ONLY",
    });
    expect(nusrat.body.request.rideId).toBeNull();
    expect(nusrat.body.request.poolGender).toBe("FEMALE_ONLY");
  });

  it("splits a route into separate stacks and accepts only the chosen pool", async () => {
    const banani = await getZoneId("Banani");
    const gulshan = await getZoneId("Gulshan 1");
    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
      poolGender: "FEMALE_ONLY",
    });
    await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });

    const open = await request(app)
      .get("/api/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(open.status).toBe(200);
    expect(open.body.stacks).toHaveLength(2);
    expect(JSON.stringify(open.body)).not.toMatch(/FEMALE|MALE|gender/i);

    const nusratStack = open.body.stacks.find(
      (stack: { passengers: { name: string }[] }) =>
        stack.passengers.some((passenger) => passenger.name === "Nusrat"),
    );
    expect(nusratStack.passengers).toEqual([
      expect.objectContaining({ name: "Nusrat" }),
    ]);

    const accept = await request(app)
      .post("/api/driver/request-stacks/accept")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        pickupZoneId: banani,
        destinationZoneId: gulshan,
        type: "SHARED",
        stackKey: nusratStack.key,
      });
    expect(accept.status).toBe(200);
    expect(accept.body.requests).toHaveLength(1);
    expect(accept.body.requests[0].status).toBe("MATCHED");
    trackedRideIds.add(accept.body.rideId);

    const stillOpen = await request(app)
      .get("/api/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(stillOpen.body.stacks).toHaveLength(1);
    expect(stillOpen.body.stacks[0].passengers[0].name).toBe("Rafiq");

    const rides = await request(app)
      .get("/api/driver/rides")
      .set("Authorization", `Bearer ${driverToken}`);
    const ride = rides.body.rides.find(
      (item: { id: string }) => item.id === accept.body.rideId,
    );
    expect(ride.passengers).toEqual([
      {
        name: "Nusrat",
        farePaisa: expect.any(Number),
        destinationZone: { id: gulshan, name: "Gulshan 1" },
      },
    ]);
    expect(JSON.stringify(ride.passengers)).not.toMatch(/gender/i);
  });

  it("ignores a gender preference on a fully reserved ride", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const nusratToken = await login("nusrat@oitesla.test");

    const solo = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SOLO",
      seatsRequested: 1,
      paymentMethod: "CASH",
      poolGender: "FEMALE_ONLY",
    });
    expect(solo.status).toBe(201);
    expect(solo.body.request.poolGender).toBe("ANY");
  });
});
