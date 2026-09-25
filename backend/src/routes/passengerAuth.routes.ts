import { Router } from "express";
import { registerPassengerHandler } from "../controllers/passengerAuth.controller.js";

export const passengerAuthRouter = Router();

passengerAuthRouter.post("/register", registerPassengerHandler);
