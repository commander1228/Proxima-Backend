import Redis from "ioredis";

// Initialize and export Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD, // Uncomment if needed
});

export default redis;
