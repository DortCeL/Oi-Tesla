import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "./errorHandler.js";
import { verifyAuthToken } from "../utils/jwt.js";

export function requireAuth(allowedRoles?: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      next(new AppError(401, "Missing or invalid authorization header"));
      return;
    }

    try {
      const payload = verifyAuthToken(header.slice(7));
      req.user = { id: payload.sub, role: payload.role };

      if (allowedRoles && !allowedRoles.includes(payload.role)) {
        next(new AppError(403, "Forbidden"));
        return;
      }

      next();
    } catch {
      next(new AppError(401, "Invalid or expired token"));
    }
  };
}
