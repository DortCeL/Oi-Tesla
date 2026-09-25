import { Router } from "express";
import { driverAuthRouter } from "./driverAuth.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth/driver", driverAuthRouter);
