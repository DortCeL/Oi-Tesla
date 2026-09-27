import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import {
  cancelRideRequestHandler,
  createRideRequestHandler,
  estimateRideRequestHandler,
  getPassengerRideRequestHandler,
  getRideRequestPoolMatesHandler,
  listPassengerRideHistoryHandler,
  listPassengerRideRequestsHandler,
} from "../controllers/rideRequest.controller.js";

export const rideRequestRouter = Router();

rideRequestRouter.get(
  "/mine",
  requireAuth([Role.PASSENGER]),
  listPassengerRideRequestsHandler,
);
rideRequestRouter.get(
  "/history",
  requireAuth([Role.PASSENGER]),
  listPassengerRideHistoryHandler,
);
rideRequestRouter.post(
  "/estimate",
  requireAuth([Role.PASSENGER]),
  estimateRideRequestHandler,
);
rideRequestRouter.post(
  "/",
  requireAuth([Role.PASSENGER]),
  createRideRequestHandler,
);
rideRequestRouter.get(
  "/:id/pool-mates",
  requireAuth([Role.PASSENGER]),
  getRideRequestPoolMatesHandler,
);
rideRequestRouter.get(
  "/:id",
  requireAuth([Role.PASSENGER]),
  getPassengerRideRequestHandler,
);
rideRequestRouter.post(
  "/:id/cancel",
  requireAuth([Role.PASSENGER]),
  cancelRideRequestHandler,
);
