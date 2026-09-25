import { Router } from "express";
import { driverAuthRouter } from "./driverAuth.routes.js";
import { driverRouter } from "./driver.routes.js";
import { passengerAuthRouter } from "./passengerAuth.routes.js";
import { zonesRouter } from "./zones.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth/driver", driverAuthRouter);
apiRouter.use("/auth/passenger", passengerAuthRouter);
apiRouter.use("/driver", driverRouter);
apiRouter.use("/zones", zonesRouter);
