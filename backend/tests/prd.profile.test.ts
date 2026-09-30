import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/db/prisma.js";
import {
  app,
  cleanupAllDemoRides,
  createAndAcceptRideRequest,
  createRideRequest,
  getZoneId,
  login,
  setDriverOnline,
} from "./helpers.js";

const blankEmail = "blank.profile@oitesla.test";

async function removeBlankPassenger() {
  const user = await prisma.user.findUnique({ where: { email: blankEmail } });
  if (!user) return;

  const requests = await prisma.rideRequest.findMany({
    where: { passengerId: user.id },
    select: { id: true, rideId: true },
  });
  const requestIds = requests.map((row) => row.id);
  const rideIds = requests.flatMap((row) => (row.rideId ? [row.rideId] : []));

  if (requestIds.length > 0) {
    await prisma.rideEvent.deleteMany({
      where: { OR: [{ rideRequestId: { in: requestIds } }, { rideId: { in: rideIds } }] },
    });
    await prisma.payment.deleteMany({ where: { rideRequestId: { in: requestIds } } });
    await prisma.rideRequest.deleteMany({ where: { id: { in: requestIds } } });
  }
  if (rideIds.length > 0) {
    await prisma.ride.deleteMany({ where: { id: { in: rideIds } } });
  }
  await prisma.passenger.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

describe("passenger profile fields", () => {
  afterEach(async () => {
    await cleanupAllDemoRides();
    await removeBlankPassenger();
  });

  it("returns name and gender without occupation, affiliation, or hobbies", async () => {
    const token = await login("nusrat@oitesla.test");
    const res = await request(app)
      .get("/api/auth/passenger/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Nusrat");
    expect(res.body.user.gender).toBe("FEMALE");
    const payload = JSON.stringify(res.body);
    expect(payload).not.toMatch(/occupation|affiliation|hobbies/i);
  });

  it("registers a passenger with name, phone, and gender only", async () => {
    const registered = await request(app).post("/api/auth/passenger/register").send({
      name: "Blank Profile",
      email: blankEmail,
      phone: "+8801799000099",
      nid: "9876543210",
      password: "password123",
      gender: "FEMALE",
    });

    expect(registered.status).toBe(201);
    expect(registered.body.user.name).toBe("Blank Profile");
    expect(registered.body.user.gender).toBe("FEMALE");
    expect(JSON.stringify(registered.body)).not.toMatch(/occupation|affiliation|hobbies|nid/i);
  });

  it("shows pool mates name, gender, and destination only", async () => {
    const banani = await getZoneId("Banani");
    const bashundhara = await getZoneId("Bashundhara");
    const driverToken = await login("jashim@oitesla.test");
    await setDriverOnline(driverToken, true);

    const registered = await request(app).post("/api/auth/passenger/register").send({
      name: "Blank Profile",
      email: blankEmail,
      phone: "+8801799000099",
      nid: "9876543210",
      password: "password123",
      gender: "FEMALE",
    });
    expect(registered.status).toBe(201);

    const nusratToken = await login("nusrat@oitesla.test");
    const nusratRide = await createAndAcceptRideRequest(nusratToken, driverToken, {
      pickupZoneId: banani,
      destinationZoneId: bashundhara,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(nusratRide.status).toBe(201);

    const blankRide = await createRideRequest(registered.body.token as string, {
      pickupZoneId: banani,
      destinationZoneId: bashundhara,
      type: "SHARED",
      seatsRequested: 1,
      paymentMethod: "CASH",
    });
    expect(blankRide.status).toBe(201);
    expect(blankRide.body.request.rideId).toBe(nusratRide.body.request.rideId);

    const seenByNusrat = await request(app)
      .get(`/api/ride-requests/${nusratRide.body.request.id}/pool-mates`)
      .set("Authorization", `Bearer ${nusratToken}`);
    expect(seenByNusrat.status).toBe(200);
    expect(seenByNusrat.body.poolMates).toEqual([
      {
        name: "Blank Profile",
        gender: "FEMALE",
        destinationZone: { id: bashundhara, name: "Bashundhara" },
      },
    ]);

    const payload = JSON.stringify(seenByNusrat.body);
    expect(payload).not.toMatch(/fare|occupation|affiliation|hobbies|payment/i);
  });
});
