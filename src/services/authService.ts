import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  createUser,
  getUserByEmail,
  getUserById,
  userExists,
} from "../services/userService";
import { User } from "@prisma/client";

export async function registerUser(
  email: string,
  displayId: string,
  password: string,
) {
  if (await userExists(email, displayId)) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return await createUser(email, displayId, hashedPassword);
}

export async function loginUser(email: string, password: string) {
  const user = await getUserByEmail(email);

  if (!user || user.deleted) {
    throw new Error("incorrect credentials");
  }

  const passwordCorrect = await bcrypt.compare(password, user.password);
  if (!passwordCorrect) {
    throw new Error("incorrect credentials");
  }

  const accessToken = await genAccessTokenFromUser(user);
  const refreshToken = await genRefreshTokenFromUser(user);

  return { email: user.email, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const user = await userFromRefreshToken(refreshToken);

    if (!user || user.deleted) {
      throw new Error("user does not exist");
    }

    const newAccessToken = await genAccessTokenFromUser(user);

    return await {accessToken: newAccessToken};
  } catch (err) {
    throw new Error("invalid refresh token");
  }
}

export async function genAccessTokenFromUser(user: User) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
}

export async function genRefreshTokenFromUser(user: User) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: "7d" },
  );
}

export async function userFromAccessToken(token: string) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number;
      email: string;
    };

    const user = await getUserById(payload.userId);

    if (!user) {
      throw new Error("user does not exist");
    }

    return user;
  } catch (error) {
    throw new Error("invalid token");
  }
}

export async function userFromRefreshToken(token: string) {
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET as string,
    ) as { userId: number; email: string };

    const user = await getUserById(payload.userId);

    if (!user) {
      throw new Error("user does not exist");
    }

    return user;
  } catch (error) {
    throw new Error("invalid token");
  }
}
