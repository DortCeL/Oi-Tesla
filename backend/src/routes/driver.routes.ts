import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { setDriverStatusHandler } from "../controllers/driver.controller.js";
import {
  acceptRequestStackHandler,
  acceptRideRequestHandler,
  completeRideHandler,
  getDriverRideHandler,
  listDriverRequestsHandler,
  listDriverRidesHandler,
  markDriverArrivalHandler,
  startRideHandler,
} from "../controllers/ride.controller.js";

export const driverRouter = Router();

driverRouter.patch(
  "/status",
  requireAuth([Role.DRIVER]),
  setDriverStatusHandler,
);
driverRouter.get(
  "/requests",
  requireAuth([Role.DRIVER]),
  listDriverRequestsHandler,
);
driverRouter.post(
  "/request-stacks/accept",
  requireAuth([Role.DRIVER]),
  acceptRequestStackHandler,
);
driverRouter.post(
  "/requests/:requestId/accept",
  requireAuth([Role.DRIVER]),
  acceptRideRequestHandler,
);
driverRouter.get(
  "/rides",
  requireAuth([Role.DRIVER]),
  listDriverRidesHandler,
);
driverRouter.get(
  "/rides/:rideId",
  requireAuth([Role.DRIVER]),
  getDriverRideHandler,
);
driverRouter.patch(
  "/rides/:rideId/arrive",
  requireAuth([Role.DRIVER]),
  markDriverArrivalHandler,
);
driverRouter.patch(
  "/rides/:rideId/start",
  requireAuth([Role.DRIVER]),
  startRideHandler,
);
driverRouter.patch(
  "/rides/:rideId/complete",
  requireAuth([Role.DRIVER]),
  completeRideHandler,
);
