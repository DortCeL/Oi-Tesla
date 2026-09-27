import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  clearDriverOfflineQueue,
  setDriverOnlineStatus,
} from "../services/driver.service.js";
import { setDriverStatusSchema } from "../validators/driver.validator.js";

export async function setDriverStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const input = setDriverStatusSchema.parse(req.body);
    const user = await setDriverOnlineStatus(req.user.id, input);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function clearDriverOfflineQueueHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, "Unauthorized"));
      return;
    }

    const user = await clearDriverOfflineQueue(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
