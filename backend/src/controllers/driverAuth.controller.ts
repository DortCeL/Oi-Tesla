import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  getDriverProfile,
  loginDriver,
  registerDriver,
} from "../services/driverAuth.service.js";
import {
  driverLoginSchema,
  driverRegisterSchema,
} from "../validators/driverAuth.validator.js";

export async function registerDriverHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = driverRegisterSchema.parse(req.body);
    const result = await registerDriver(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginDriverHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = driverLoginSchema.parse(req.body);
    const result = await loginDriver(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDriverMeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const user = await getDriverProfile(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
