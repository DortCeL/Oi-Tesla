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

type StackBody = {
  destinationZone: { name: string };
  type: string;
  waitingCount: number;
  acceptCount: number;
  totalFarePaisa: number;
};

describe("driver request stacks", () => {
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

  it("stacks same route shared requests and accepts them together", async () => {
    const banani = await getZoneId("Banani");
    const gulshan = await getZoneId("Gulshan 1");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");

    const fares: number[] = [];
    for (const token of [nusratToken, rafiqToken, shirinToken]) {
      const res = await createRideRequest(token, {
        pickupZoneId: banani,
        destinationZoneId: gulshan,
        type: "SHARED",
        seatsRequested: 1,
        paymentMethod: "CASH",
      });
      expect(res.status).toBe(201);
      expect(res.body.request.status).toBe("REQUESTED");
      fares.push(res.body.request.farePaisa as number);
    }

    const expectedTotal = fares.reduce((sum, fare) => sum + fare, 0);

    const open = await request(app)
      .get("/api/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(open.status).toBe(200);
    expect(open.body.stacks).toHaveLength(1);
    expect(open.body.stacks[0].waitingCount).toBe(3);
    expect(open.body.stacks[0].acceptCount).toBe(3);
    expect(open.body.stacks[0].type).toBe("SHARED");
    expect(open.body.stacks[0].totalFarePaisa).toBe(expectedTotal);
    expect(open.body.stacks[0].passengers).toHaveLength(3);

    const accept = await request(app)
      .post("/api/driver/request-stacks/accept")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        pickupZoneId: banani,
        destinationZoneId: gulshan,
        type: "SHARED",
      });
    expect(accept.status).toBe(200);
    expect(accept.body.requests).toHaveLength(3);
    expect(accept.body.totalFarePaisa).toBe(expectedTotal);
    trackedRideIds.add(accept.body.rideId);

    const ride = await prisma.ride.findUniqueOrThrow({
      where: { id: accept.body.rideId },
    });
    expect(ride.seatsTaken).toBe(3);
    expect(ride.status).toBe("MATCHED");
  });

  it("keeps different destinations and lists the higher fare first", async () => {
    const banani = await getZoneId("Banani");
    const mohakhali = await getZoneId("Mohakhali");
    const bashundhara = await getZoneId("Bashundhara");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");
    const shirinToken = await login("shirin@oitesla.test");

    const bash = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: bashundhara,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(bash.status).toBe(201);

    const moh1 = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(moh1.status).toBe(201);

    const moh2 = await createRideRequest(shirinToken, {
      pickupZoneId: banani,
      destinationZoneId: mohakhali,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(moh2.status).toBe(201);

    const open = await request(app)
      .get("/api/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);

    const stacks = open.body.stacks as StackBody[];
    expect(stacks).toHaveLength(2);

    const byDest = Object.fromEntries(
      stacks.map((stack) => [stack.destinationZone.name, stack]),
    );

    expect(byDest.Mohakhali.waitingCount).toBe(2);
    expect(byDest.Mohakhali.totalFarePaisa).toBe(
      (moh1.body.request.farePaisa as number) + (moh2.body.request.farePaisa as number),
    );
    expect(byDest.Bashundhara.waitingCount).toBe(1);
    expect(byDest.Bashundhara.totalFarePaisa).toBe(bash.body.request.farePaisa);

    expect(stacks[0].totalFarePaisa).toBeGreaterThanOrEqual(stacks[1].totalFarePaisa);
  });

  it("stacks solo separately and accepting takes only one", async () => {
    const banani = await getZoneId("Banani");
    const gulshan = await getZoneId("Gulshan 1");

    const driverToken = await login("jashim@oitesla.test");
    const nusratToken = await login("nusrat@oitesla.test");
    const rafiqToken = await login("rafiq@oitesla.test");

    const shared = await createRideRequest(nusratToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(shared.status).toBe(201);

    const solo = await createRideRequest(rafiqToken, {
      pickupZoneId: banani,
      destinationZoneId: gulshan,
      type: "SOLO",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(solo.status).toBe(201);

    const open = await request(app)
      .get("/api/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);

    const stacks = open.body.stacks as StackBody[];
    expect(stacks).toHaveLength(2);
    const soloStack = stacks.find((stack) => stack.type === "SOLO");
    const sharedStack = stacks.find((stack) => stack.type === "SHARED");
    expect(soloStack?.acceptCount).toBe(1);
    expect(sharedStack?.acceptCount).toBe(1);

    const accept = await request(app)
      .post("/api/driver/request-stacks/accept")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        pickupZoneId: banani,
        destinationZoneId: gulshan,
        type: "SOLO",
      });
    expect(accept.status).toBe(200);
    expect(accept.body.requests).toHaveLength(1);
    trackedRideIds.add(accept.body.rideId);

    const after = await request(app)
      .get("/api/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(
      (after.body.stacks as StackBody[]).some((stack) => stack.type === "SHARED"),
    ).toBe(true);
  });
});
