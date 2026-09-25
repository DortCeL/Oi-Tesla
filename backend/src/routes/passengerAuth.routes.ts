import { Router } from "express";
import {
  loginPassengerHandler,
  registerPassengerHandler,
} from "../controllers/passengerAuth.controller.js";

export const passengerAuthRouter = Router();

passengerAuthRouter.post("/register", registerPassengerHandler);
passengerAuthRouter.post("/login", loginPassengerHandler);
