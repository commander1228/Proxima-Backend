import { prisma } from "../utils/prisma";

export async function muteLocationDao(userId: number, locationId: number, locationName: string) {
  return prisma.mutedLocation.upsert({
    where: { userId_locationId: { userId, locationId } },
    create: { userId, locationId, locationName },
    update: {},
  });
}

export async function unmuteLocationDao(userId: number, locationId: number) {
  return prisma.mutedLocation.deleteMany({
    where: { userId, locationId },
  });
}

export async function getMutedLocationsDao(userId: number) {
  return prisma.mutedLocation.findMany({
    where: { userId },
    select: { locationId: true, locationName: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMutedLocationIdsDao(userId: number): Promise<Set<number>> {
  const rows = await prisma.mutedLocation.findMany({
    where: { userId },
    select: { locationId: true },
  });
  return new Set(rows.map((r) => r.locationId));
}
