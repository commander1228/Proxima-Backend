import { Request } from "express";
import { User } from "@prisma/client";

export type AuthRequest = Request & { user: User };