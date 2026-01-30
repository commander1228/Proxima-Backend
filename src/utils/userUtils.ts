import { PrismaClient, User } from '@prisma/client';
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export async function userExists(
  email: string,
  displayId: string,
): Promise<boolean> {
  const where: any = { OR: [{ email }] };
  if (displayId) {
    where.OR.push({ displayId });
  }
  const user = await prisma.user.findFirst({ where });
  return !!user;
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function getUserById(id: number){
  const user = prisma.user.findUnique({
    where: { id },
  });

  return user;
}

export async function userFromAccessToken(token:  string) {
  try{
  const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as { userId: number; email: string };


  const user = await getUserById(payload.userId);

  if(!user){
     throw new Error("user does not exist");
  }

  return user;
} catch (error){
  throw new Error("invalid token");
  }
}

export async function genNewAccessToken(userId: number) {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error("user does not exist");
  }

  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );

  return accessToken;
}
