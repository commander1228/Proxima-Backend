import { PrismaClient, Prisma } from "@prisma/client";
export const prisma = new PrismaClient();

export type DB = Prisma.TransactionClient | PrismaClient;

export async function runTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}