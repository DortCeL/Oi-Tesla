import { Prisma, Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { toDriverResponse } from "../utils/driverMapper.js";
import type { DriverLoginInput, DriverRegisterInput } from "../validators/driverAuth.validator.js";

const driverInclude = {
  driver: { include: { teslas: true } },
} satisfies Prisma.UserInclude;

export async function registerDriver(input: DriverRegisterInput) {
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
      role: Role.DRIVER,
      gender: input.gender,
      driver: {
        create: {
          isOnline: false,
          teslas: {
            create: {
              name: input.tesla.name,
              capacity: input.tesla.capacity,
              isActive: true,
            },
          },
        },
      },
    },
    include: driverInclude,
  });

  const token = signAuthToken({ sub: user.id, role: user.role });
  return { token, user: toDriverResponse(user) };
}

export async function loginDriver(input: DriverLoginInput) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.emailOrPhone }, { phone: input.emailOrPhone }],
    },
    include: driverInclude,
  });

  if (!user || user.role !== Role.DRIVER || !user.driver) {
    throw new AppError(401, "Invalid email/phone or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email/phone or password");
  }

  const token = signAuthToken({ sub: user.id, role: user.role });
  return { token, user: toDriverResponse(user) };
}

export async function getDriverProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: driverInclude,
  });

  if (!user || user.role !== Role.DRIVER || !user.driver) {
    throw new AppError(404, "Driver not found");
  }

  return toDriverResponse(user);
}
