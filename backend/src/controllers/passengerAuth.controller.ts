import type { NextFunction, Request, Response } from "express";
import { registerPassenger } from "../services/passengerAuth.service.js";
import { passengerRegisterSchema } from "../validators/passengerAuth.validator.js";

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
