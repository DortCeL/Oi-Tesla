import { Prisma, Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { hashPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { toPassengerResponse } from "../utils/passengerMapper.js";
import type { PassengerRegisterInput } from "../validators/passengerAuth.validator.js";

const passengerInclude = {
  passenger: { include: { addressZone: true } },
} satisfies Prisma.UserInclude;

export async function registerPassenger(input: PassengerRegisterInput) {
  const zone = await prisma.zone.findUnique({
    where: { id: input.addressZoneId },
  });

  if (!zone) {
    throw new AppError(400, "Invalid address zone");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }] },
  });

  if (existing) {
    throw new AppError(409, "Email or phone already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: Role.PASSENGER,
      gender: input.gender,
      passenger: {
        create: {
          addressZoneId: input.addressZoneId,
          occupation: input.occupation,
          affiliation: input.affiliation,
        },
      },
    },
    include: passengerInclude,
  });

  const token = signAuthToken({ sub: user.id, role: user.role });
  return { token, user: toPassengerResponse(user) };
}
