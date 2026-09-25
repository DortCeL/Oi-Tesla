import { Router } from "express";
import {
  loginDriverHandler,
  registerDriverHandler,
} from "../controllers/driverAuth.controller.js";

export const driverAuthRouter = Router();

driverAuthRouter.post("/register", registerDriverHandler);
driverAuthRouter.post("/login", loginDriverHandler);
