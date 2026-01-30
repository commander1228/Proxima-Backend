
import { User } from "@prisma/client";

declare global {
  namespace Express {
    export interface Request {
      user?: User;
    }
  }
}

export {};

declare global {
  namespace SocketIO {
    interface Socket {
      user?: User;
    }
  }
}

// For socket.io v4+, the correct way is:
declare module "socket.io" {
  interface Socket {
    user?: User;
  }
}
