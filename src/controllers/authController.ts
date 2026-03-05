import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  sendOneTimeCode,
  verifyOneTimeCode,
} from "../services/authService";
import { getUserByEmail } from "../services/userService";
import { touchUserActivity } from "../notifications";
import { setSession, clearSession, hasSession } from "../utils/redisSession";
import { getIo } from "../websocket/ioInstance";

export async function register(req: Request, res: Response) {
  try {
    const { email, displayId, password } = req.body;
    const user = await registerUser(email, displayId, password);
    await sendOneTimeCode(user.email);
    return res.status(201).json({
      message: "OTP sent",
      user: { id: user.id, email: user.email, displayId: user.displayId },
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password, force } = req.body;

    const user = await getUserByEmail(email);

    if (user?.isVerified == false) {
      const response = await sendOneTimeCode(user.email);
      return res.status(202).json({ response });
    }

    if (user) {
      const sessionActive = await hasSession(user.id);
      if (sessionActive && !force) {
        return res.status(409).json({ error: "ALREADY_ACTIVE" });
      }
      if (sessionActive && force) {
        const io = getIo();
        if (io) {
          io.to(`user:${user.id}`).emit("sessionKicked");
        }
        await clearSession(user.id);
      }
    }

    const response = await loginUser(email, password);

    if (user) {
      await setSession(user.id);
      touchUserActivity(user.id).catch(() => {});
    }

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

export async function logout(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (userId) {
      await clearSession(userId);
    }
    return res.status(200).json({ message: "Logged out" });
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
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
