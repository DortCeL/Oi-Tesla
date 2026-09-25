import { Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { getDriverProfile } from "./driverAuth.service.js";
import type { SetDriverStatusInput } from "../validators/driver.validator.js";

export async function setDriverOnlineStatus(
  userId: string,
  input: SetDriverStatusInput,
) {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!driver || driver.user.role !== Role.DRIVER) {
    throw new AppError(404, "Driver not found");
  }

  if (driver.isOnline !== input.isOnline) {
    await prisma.driver.update({
      where: { userId },
      data: { isOnline: input.isOnline },
    });
  }

  return getDriverProfile(userId);
}
