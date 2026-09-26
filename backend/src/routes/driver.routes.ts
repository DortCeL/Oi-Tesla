import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { setDriverStatusHandler } from "../controllers/driver.controller.js";
import {
  completeRideHandler,
  markDriverArrivalHandler,
  startRideHandler,
} from "../controllers/ride.controller.js";

export const driverRouter = Router();

driverRouter.patch(
  "/status",
  requireAuth([Role.DRIVER]),
  setDriverStatusHandler,
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
