import { PrismaClient } from "../generated/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  getUserByEmail,
  userExists,
  genNewAccessToken,
} from "../utils/userUtils";

const prisma = new PrismaClient();

export async function registerUser(
  email: string,
  displayId: string,
  password: string,
) {
  if (await userExists(email, displayId)) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      displayId,
      password: hashedPassword,
    },
  });
}

export async function loginUser(email: string, password: string) {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("incorrect credentials");
  }

  const passwordCorrect = await bcrypt.compare(password, user.password);
  if (!passwordCorrect) {
    throw new Error("incorrect credentials");
  }

  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: "7d" },
  );

  return { email: user.email, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string,
    ) as { userId: number; email: string };

    const newAccessToken = await genNewAccessToken(payload.userId);

    return { accessToken: newAccessToken };
  } catch (err) {
    throw new Error("invalid refresh token");
  }
}
