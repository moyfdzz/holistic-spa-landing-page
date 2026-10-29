// @vitest-environment node
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { appSettings } from "./schema.js";

// A throwaway in-memory Postgres (PGlite) runs the committed migrations, so the test
// checks the real SQL and needs no Docker, no service container and no secrets.
const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

describe("app_settings", () => {
  const client = new PGlite();
  const db = drizzle(client);

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  it("keeps one row when the same key is inserted twice", async () => {
    await db
      .insert(appSettings)
      .values({ key: "chat_enabled", value: "true" })
      .onConflictDoNothing();
    await db
      .insert(appSettings)
      .values({ key: "chat_enabled", value: "false" })
      .onConflictDoNothing();
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "chat_enabled"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe("true");
  });

  it("rejects a plain duplicate insert", async () => {
    await db.insert(appSettings).values({ key: "duplicate", value: "a" });
    await expect(
      db.insert(appSettings).values({ key: "duplicate", value: "b" }),
    ).rejects.toThrow();
  });

  it("fills updated_at by default", async () => {
    await db.insert(appSettings).values({ key: "with_date", value: "x" });
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "with_date"));
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });
});
