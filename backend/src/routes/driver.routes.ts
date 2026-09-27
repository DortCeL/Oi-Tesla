import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import {
  clearDriverOfflineQueueHandler,
  setDriverStatusHandler,
} from "../controllers/driver.controller.js";
import {
  acceptRequestStackHandler,
  acceptRideRequestHandler,
  completeRideHandler,
  getDriverRideHandler,
  listDriverRequestsHandler,
  listDriverRideHistoryHandler,
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
driverRouter.post(
  "/status/stay-online",
  requireAuth([Role.DRIVER]),
  clearDriverOfflineQueueHandler,
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
  "/rides/history",
  requireAuth([Role.DRIVER]),
  listDriverRideHistoryHandler,
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
