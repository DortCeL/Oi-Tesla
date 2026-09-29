import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

export const app = createApp();
export const DEMO_PASSWORD = "password123";

export async function login(
  emailOrPhone: string,
  password = DEMO_PASSWORD,
): Promise<string> {
  const rolePath = emailOrPhone.includes("jashim") ? "driver" : "passenger";
  const res = await request(app)
    .post(`/api/auth/${rolePath}/login`)
    .send({ emailOrPhone, password });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${emailOrPhone}: ${res.status} ${res.text}`);
  }

  return res.body.token as string;
}

export async function setDriverOnline(
  token: string,
  isOnline = true,
  zoneIds?: number[],
) {
  let resolvedZoneIds = zoneIds;
  if (isOnline && !resolvedZoneIds) {
    const zones = await prisma.zone.findMany({ select: { id: true } });
    resolvedZoneIds = zones.map((zone) => zone.id);
  }

  const body =
    isOnline && resolvedZoneIds
      ? { isOnline, zoneIds: resolvedZoneIds }
      : { isOnline };

  const res = await request(app)
    .patch("/api/driver/status")
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  if (res.status !== 200) {
    throw new Error(`setDriverOnline failed: ${res.status} ${res.text}`);
  }
}

export async function createRideRequest(
  token: string,
  body: {
    pickupZoneId: number;
    destinationZoneId: number;
    type: "SOLO" | "SHARED";
    seatsRequested: 1 | 2;
    paymentMethod: "CASH" | "TESLAPAY";
    poolGender?: "ANY" | "FEMALE_ONLY" | "MALE_ONLY";
  },
) {
  return request(app)
    .post("/api/ride-requests")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

export async function acceptRideRequest(driverToken: string, requestId: string) {
  return request(app)
    .post(`/api/driver/requests/${requestId}/accept`)
    .set("Authorization", `Bearer ${driverToken}`);
}

/** Book, then accept when the request is still waiting. Joiners already on a ride are returned as-is. */
export async function createAndAcceptRideRequest(
  passengerToken: string,
  driverToken: string,
  body: {
    pickupZoneId: number;
    destinationZoneId: number;
    type: "SOLO" | "SHARED";
    seatsRequested: 1 | 2;
    paymentMethod: "CASH" | "TESLAPAY";
    poolGender?: "ANY" | "FEMALE_ONLY" | "MALE_ONLY";
  },
) {
  const book = await createRideRequest(passengerToken, body);
  if (book.status !== 201 || book.body.request.rideId) {
    return book;
  }

  const accepted = await acceptRideRequest(driverToken, book.body.request.id as string);
  if (accepted.status !== 200) {
    return accepted;
  }

  return {
    status: 201,
    body: { request: accepted.body.request },
  };
}

export async function cancelRideRequest(token: string, requestId: string) {
  return request(app)
    .post(`/api/ride-requests/${requestId}/cancel`)
    .set("Authorization", `Bearer ${token}`);
}

export async function driverArrive(token: string, rideId: string) {
  return request(app)
    .patch(`/api/driver/rides/${rideId}/arrive`)
    .set("Authorization", `Bearer ${token}`);
}

export async function driverStart(token: string, rideId: string) {
  return request(app)
    .patch(`/api/driver/rides/${rideId}/start`)
    .set("Authorization", `Bearer ${token}`);
}

export async function driverComplete(token: string, rideId: string) {
  return request(app)
    .patch(`/api/driver/rides/${rideId}/complete`)
    .set("Authorization", `Bearer ${token}`);
}

export async function getZoneId(name: string): Promise<number> {
  const zone = await prisma.zone.findFirst({ where: { name } });
  if (!zone) {
    throw new Error(`Zone not found: ${name}`);
  }
  return zone.id;
}

export async function cleanupRides(rideIds: string[]) {
  if (rideIds.length === 0) {
    return;
  }

  const requestIds = (
    await prisma.rideRequest.findMany({
      where: { rideId: { in: rideIds } },
      select: { id: true },
    })
  ).map((row) => row.id);

  await prisma.rideEvent.deleteMany({
    where: {
      OR: [
        { rideId: { in: rideIds } },
        ...(requestIds.length > 0
          ? [{ rideRequestId: { in: requestIds } }]
          : []),
      ],
    },
  });
  await prisma.payment.deleteMany({
    where: { rideRequest: { rideId: { in: rideIds } } },
  });
  await prisma.rideRequest.deleteMany({ where: { rideId: { in: rideIds } } });
  await prisma.ride.deleteMany({ where: { id: { in: rideIds } } });
}

/** Wipe all demo-app rides so tests start from a clean pool state. */
export async function getRideRequest(token: string, requestId: string) {
  return request(app)
    .get(`/api/ride-requests/${requestId}`)
    .set("Authorization", `Bearer ${token}`);
}

export async function cleanupAllDemoRides() {
  const demoEmails = [
    "jashim@oitesla.test",
    "nusrat@oitesla.test",
    "rafiq@oitesla.test",
    "shirin@oitesla.test",
  ];

  const rideIds = (
    await prisma.ride.findMany({
      where: {
        OR: [
          { driver: { user: { email: "jashim@oitesla.test" } } },
          {
            requests: {
              some: { passenger: { user: { email: { in: demoEmails } } } },
            },
          },
        ],
      },
      select: { id: true },
    })
  ).map((ride) => ride.id);

  await cleanupRides(rideIds);

  const orphanIds = (
    await prisma.rideRequest.findMany({
      where: {
        rideId: null,
        passenger: { user: { email: { in: demoEmails } } },
      },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (orphanIds.length > 0) {
    await prisma.rideEvent.deleteMany({
      where: { rideRequestId: { in: orphanIds } },
    });
    await prisma.payment.deleteMany({
      where: { rideRequestId: { in: orphanIds } },
    });
    await prisma.rideRequest.deleteMany({ where: { id: { in: orphanIds } } });
  }
}
