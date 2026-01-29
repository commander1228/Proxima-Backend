import { Request, Response, NextFunction } from "express";
import { userFromAccessToken } from "../utils/userUtils";
import jwt from "jsonwebtoken";

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const user = await userFromAccessToken(token);

    if(!user){
        return res.status(403).json({message: "user no longer exists"})
    }

    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}