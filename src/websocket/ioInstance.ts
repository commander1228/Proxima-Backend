import { Server } from "socket.io";

let _io: Server | null = null;

export function setIo(io: Server): void {
  _io = io;
}

export function getIo(): Server | null {
  return _io;
}
