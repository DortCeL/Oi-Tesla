import { Router } from "express";
import { driverAuthRouter } from "./driverAuth.routes.js";
import { driverRouter } from "./driver.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth/driver", driverAuthRouter);
apiRouter.use("/driver", driverRouter);
