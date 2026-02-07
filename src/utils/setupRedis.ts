
import Redis from "ioredis";

// Initialize and export Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
});

// Connection verification
redis.on("connect", () => {
  console.log("Redis connected successfully.");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Optional: Test command
redis.ping()
  .then((result) => {
    console.log("Redis PING response:", result);
  })
  .catch((err) => {
    console.error("Redis PING failed:", err);
  });

export default redis;
