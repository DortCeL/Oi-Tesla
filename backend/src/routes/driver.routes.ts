import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { setDriverStatusHandler } from "../controllers/driver.controller.js";
import { markDriverArrivalHandler } from "../controllers/ride.controller.js";

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
