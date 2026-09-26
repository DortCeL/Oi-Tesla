import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  completeRide,
  markDriverArrival,
  startRide,
} from "../services/ride.service.js";

function getRideIdParam(req: Request): string {
  const rideId = req.params.rideId;
  if (typeof rideId !== "string") {
    throw new AppError(400, "Invalid ride id");
  }
  return rideId;
}

export async function markDriverArrivalHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const ride = await markDriverArrival(req.user.id, getRideIdParam(req));
    res.json({ ride });
  } catch (err) {
    next(err);
  }
}

export async function startRideHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const ride = await startRide(req.user.id, getRideIdParam(req));
    res.json({ ride });
  } catch (err) {
    next(err);
  }
}

export async function completeRideHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const ride = await completeRide(req.user.id, getRideIdParam(req));
    res.json({ ride });
  } catch (err) {
    next(err);
  }
}
