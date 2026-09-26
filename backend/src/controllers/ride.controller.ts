import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { markDriverArrival } from "../services/ride.service.js";

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

    const ride = await markDriverArrival(req.user.id, req.params.rideId);
    res.json({ ride });
  } catch (err) {
    next(err);
  }
}
