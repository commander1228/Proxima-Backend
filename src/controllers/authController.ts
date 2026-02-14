import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  sendOneTimeCode,
  verifyOneTimeCode,
} from "../services/authService";
import { getUserByEmail } from "../services/userService";

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

    const user = await getUserByEmail(email);

    if (user?.isVerified == false) {
      const response = await sendOneTimeCode(user.email);
      return res.status(202).json({ response });
    }

    const response = await loginUser(email, password);

    return res.status(200).json({
      message: "User Logged in Successfully",
      user: { email: response.email },
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
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

export async function sendOneTimeVerificationCode(req: Request, res: Response) {
  try {
    const { email } = req.body;
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error("user does not exist");
    }

    if (user.isVerified) {
      throw new Error("user is already verified");
    }

    const response = await sendOneTimeCode(user.email);

    return res.status(200).json({ response });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function verifyCode(req: Request, res: Response) {
  try {
    const { email, code } = req.body;

    const { user, accessToken, refreshToken } = await verifyOneTimeCode(
      email,
      code,
    );

    return res.status(200).json({
      message: "Authenticated",
      user: { id: user.id, email: user.email, displayId: user.displayId },
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
}
