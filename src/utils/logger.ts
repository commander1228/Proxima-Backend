import { createLogger, format, transports } from "winston";
export const logger = {
  info: (message: string, ...args: any[]) => console.info(message, ...args),
  warn: (message: string, ...args: any[]) => console.warn(message, ...args),
  error: (message: string, ...args: any[]) => console.error(message, ...args),
  debug: (message: string, ...args: any[]) => console.debug(message, ...args),
  log: (message: string, ...args: any[]) => console.log(message, ...args),
};
// const logger = createLogger({
//   level: process.env.NODE_ENV === "production" ? "info" : "debug",
//   format: format.combine(
//     format.timestamp(),
//     format.errors({ stack: true }),
//     format.splat(),
//     format.json()
//   ),
//   transports: [
//     new transports.Console({
//       format: format.combine(
//         format.colorize(),
//         format.simple()
//       )
//     })
//   ]
// });

export default logger;