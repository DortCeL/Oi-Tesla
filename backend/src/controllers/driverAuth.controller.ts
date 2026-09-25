import type { NextFunction, Request, Response } from "express";
import { loginDriver, registerDriver } from "../services/driverAuth.service.js";
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
