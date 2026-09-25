import { Router } from "express";
import { listZonesHandler } from "../controllers/zones.controller.js";

export const zonesRouter = Router();

zonesRouter.get("/", listZonesHandler);
