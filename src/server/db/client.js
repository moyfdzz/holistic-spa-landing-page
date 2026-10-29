/**
 * Database client for Cloudflare Workers, over Neon's serverless driver (HTTP).
 * @module server/db/client
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

/**
 * Creates a database client. Create it per request: it holds no connection.
 * @param {string} databaseUrl - The Postgres connection string (a secret).
 * @returns {ReturnType<typeof drizzle<typeof schema>>} The Drizzle client.
 */
export function createDb(databaseUrl) {
  return drizzle(neon(databaseUrl), { schema });
}
