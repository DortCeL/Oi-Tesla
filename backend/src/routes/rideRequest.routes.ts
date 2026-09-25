import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { estimateRideRequestHandler } from "../controllers/rideRequest.controller.js";

export const rideRequestRouter = Router();

rideRequestRouter.post(
  "/estimate",
  requireAuth([Role.PASSENGER]),
  estimateRideRequestHandler,
);
