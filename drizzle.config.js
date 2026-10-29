import { defineConfig } from "drizzle-kit";

// Load `.env` for local runs (Node 22); in CI the variable comes from the environment.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: use the variables already set.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.js",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
