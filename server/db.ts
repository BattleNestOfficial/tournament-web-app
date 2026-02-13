import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

/**
 * Railway REQUIRED check
 */
if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is not set in environment variables");
}

/**
 * Railway Postgres FIX
 * - SSL is mandatory
 * - rejectUnauthorized must be false
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("🔥 Unexpected PG pool error", err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });
