import { User, User_Settings } from "@prisma/client";

export type UserWithPreferences = User & { preferences?: User_Settings | null };