import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Modest pool: Next.js spawns several workers (dev + build), each with its
// own pool; keep per-process connections low to stay under PG's limit.
const client = postgres(process.env.DATABASE_URL, { max: 5 });

export const db = drizzle(client, { schema });
