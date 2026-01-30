import { Request, Response, NextFunction } from "express";
import { userFromAccessToken } from "../utils/userUtils";

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const user = await userFromAccessToken(token);

    if (!user) {
      return res.status(403).json({ message: "user no longer exists" });
    }

    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

export async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.isAdmin == false) {
    return res.status(403).json({ message: "user does not have permission" });
  }
  next();
}
