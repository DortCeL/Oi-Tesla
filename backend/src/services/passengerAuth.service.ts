import { Prisma, Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { toPassengerResponse } from "../utils/passengerMapper.js";
import type {
  PassengerLoginInput,
  PassengerRegisterInput,
} from "../validators/passengerAuth.validator.js";

const passengerInclude = {
  passenger: true,
} satisfies Prisma.UserInclude;

export async function registerPassenger(input: PassengerRegisterInput) {
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
      hobbies: input.hobbies ?? [],
      passenger: {
        create: {
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

export async function loginPassenger(input: PassengerLoginInput) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.emailOrPhone }, { phone: input.emailOrPhone }],
    },
    include: passengerInclude,
  });

  if (!user || user.role !== Role.PASSENGER || !user.passenger) {
    throw new AppError(401, "Invalid email/phone or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email/phone or password");
  }

  const token = signAuthToken({ sub: user.id, role: user.role });
  return { token, user: toPassengerResponse(user) };
}

export async function getPassengerProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: passengerInclude,
  });

  if (!user || user.role !== Role.PASSENGER || !user.passenger) {
    throw new AppError(404, "Passenger not found");
  }

  return toPassengerResponse(user);
}
