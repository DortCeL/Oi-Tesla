import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  completeRide,
  getDriverRideDetail,
  listDriverRides,
  markDriverArrival,
  startRide,
} from "../services/ride.service.js";
import {
  acceptRideRequest,
  listOpenRideRequestsForDriver,
} from "../services/pooling.service.js";

function getRequestIdParam(req: Request): string {
  const requestId = req.params.requestId;
  if (typeof requestId !== "string") {
    throw new AppError(400, "Invalid request id");
  }
  return requestId;
}

function getRideIdParam(req: Request): string {
  const rideId = req.params.rideId;
  if (typeof rideId !== "string") {
    throw new AppError(400, "Invalid ride id");
  }
  return rideId;
}

export async function listDriverRidesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const rides = await listDriverRides(req.user.id);
    res.json({ rides });
  } catch (err) {
    next(err);
  }
}

export async function getDriverRideHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const result = await getDriverRideDetail(req.user.id, getRideIdParam(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
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

export async function listDriverRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const requests = await listOpenRideRequestsForDriver(req.user.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export async function acceptRideRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const request = await acceptRideRequest(req.user.id, getRequestIdParam(req));
    res.json({ request });
  } catch (err) {
    next(err);
  }
}
