import type { NextFunction, Request, Response } from "express";
import { listZones } from "../services/zones.service.js";

export async function listZonesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const zones = await listZones();
    res.json({ zones });
  } catch (err) {
    next(err);
  }
}
