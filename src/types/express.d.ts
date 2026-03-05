import { User, User_Settings } from "@prisma/client";

type UserWithPreferences = User & { preferences?: User_Settings | null };

declare global {
  namespace Express {
    export interface Request {
      user?: UserWithPreferences;
    }
  }
}

export {};

declare global {
  namespace SocketIO {
    interface Socket {
      user?: UserWithPreferences;
    }
  }
}

// For socket.io v4+:
declare module "socket.io" {
  interface Socket {
    user?: UserWithPreferences;
  }
}