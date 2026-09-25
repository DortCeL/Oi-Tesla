import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  getPassengerProfile,
  loginPassenger,
  registerPassenger,
} from "../services/passengerAuth.service.js";
import {
  passengerLoginSchema,
  passengerRegisterSchema,
} from "../validators/passengerAuth.validator.js";

export async function registerPassengerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = passengerRegisterSchema.parse(req.body);
    const result = await registerPassenger(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginPassengerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = passengerLoginSchema.parse(req.body);
    const result = await loginPassenger(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPassengerMeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const user = await getPassengerProfile(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
