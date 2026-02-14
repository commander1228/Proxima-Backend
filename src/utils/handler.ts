import { RequestHandler, Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth";

export function withAuth(
  fn: (req: AuthRequest, res: Response) => Promise<any>
): RequestHandler {
  return async (req, res, next: NextFunction) => {
    try {
      // runtime safety check (optional)
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      await fn(req as AuthRequest, res);
    } catch (err) {
      next(err);
    }
  };
}