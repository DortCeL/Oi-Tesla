import type { NextFunction, Request, Response } from "express";
import { estimateRideRequestFare } from "../services/rideRequest.service.js";
import { rideRequestEstimateSchema } from "../validators/rideRequest.validator.js";

export async function estimateRideRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = rideRequestEstimateSchema.parse(req.body);
    const estimate = await estimateRideRequestFare(input);
    res.json(estimate);
  } catch (err) {
    next(err);
  }
}
