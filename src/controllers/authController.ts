import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
} from "../services/authService";

export async function register(req: Request, res: Response) {
  try {
    const { email, displayId, password } = req.body;
    const user = await registerUser(email, displayId, password);
    return res.status(201).json({
      message: "User registered successfully",
      user: { id: user.id, email: user.email, displayId: user.displayId },
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const {
      email: userEmail,
      accessToken,
      refreshToken,
    } = await loginUser(email, password);
    return res.status(200).json({
      message: "User Logged in Successfully",
      user: { email: userEmail },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    const accessToken = await refreshAccessToken(refreshToken);
    return res.status(200).json({
      accessToken,
      message: "user Authenticated",
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
