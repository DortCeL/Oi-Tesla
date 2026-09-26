import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  cancelRideRequest,
  createRideRequest,
  estimateRideRequestFare,
  getPassengerRideRequest,
  getRideRequestPoolMates,
  listPassengerRideRequests,
} from "../services/rideRequest.service.js";
import {
  rideRequestCreateSchema,
  rideRequestEstimateSchema,
} from "../validators/rideRequest.validator.js";

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

export async function createRideRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const input = rideRequestCreateSchema.parse(req.body);
    const request = await createRideRequest(req.user.id, input);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function getPassengerRideRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const result = await getPassengerRideRequest(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRideRequestPoolMatesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const result = await getRideRequestPoolMates(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listPassengerRideRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const requests = await listPassengerRideRequests(req.user.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export async function cancelRideRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const request = await cancelRideRequest(req.user.id, req.params.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
}
