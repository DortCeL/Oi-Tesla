import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import {
  getPassengerMeHandler,
  loginPassengerHandler,
  registerPassengerHandler,
} from "../controllers/passengerAuth.controller.js";

export const passengerAuthRouter = Router();

passengerAuthRouter.post("/register", registerPassengerHandler);
passengerAuthRouter.post("/login", loginPassengerHandler);
passengerAuthRouter.get("/me", requireAuth([Role.PASSENGER]), getPassengerMeHandler);
