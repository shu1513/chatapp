// Production migration runner. Applies drizzle/ SQL migrations using the
// drizzle-orm migrator — no drizzle-kit needed in the runtime image.
// Usage: node scripts/migrate.mjs  (DATABASE_URL required)
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
} finally {
  await client.end();
}
