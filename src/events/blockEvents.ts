import { EventEmitter } from "events";

export const blockEvents = new EventEmitter();
blockEvents.setMaxListeners(0);
