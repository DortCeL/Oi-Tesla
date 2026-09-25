import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import {
  getDriverMeHandler,
  loginDriverHandler,
  registerDriverHandler,
} from "../controllers/driverAuth.controller.js";

export const driverAuthRouter = Router();

driverAuthRouter.post("/register", registerDriverHandler);
driverAuthRouter.post("/login", loginDriverHandler);
driverAuthRouter.get("/me", requireAuth([Role.DRIVER]), getDriverMeHandler);
