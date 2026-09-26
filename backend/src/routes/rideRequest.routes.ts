import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import {
  cancelRideRequestHandler,
  createRideRequestHandler,
  estimateRideRequestHandler,
} from "../controllers/rideRequest.controller.js";

export const rideRequestRouter = Router();

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
rideRequestRouter.post(
  "/:id/cancel",
  requireAuth([Role.PASSENGER]),
  cancelRideRequestHandler,
);
