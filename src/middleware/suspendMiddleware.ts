/**
 * suspendMiddleware.ts
 * ====================
 * Express middleware that prevents suspended users from performing
 * write actions (posting, commenting, sending messages).
 *
 * Must be applied AFTER authenticateToken (which populates req.user).
 *
 * Performs lazy auto-lift: if suspendedUntil is in the past the field
 * is cleared and the request is allowed through.
 */

import { Request, Response, NextFunction } from "express";
import { isUserSuspended } from "../services/userService";

export async function requireNotSuspended(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const suspended = await isUserSuspended(user as any);
  if (suspended) {
    const until = (user as any).suspendedUntil as Date;
    return res.status(403).json({
      message: "Your account is suspended",
      suspendedUntil: until.toISOString(),
      error: "SUSPENDED",
    });
  }

  next();
}