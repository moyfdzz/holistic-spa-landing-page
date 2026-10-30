import { expect, test } from "@playwright/test";

test.describe("admin area", () => {
  test("is closed to a visitor who is not signed in", async ({ request }) => {
    // The test server has no Clerk settings, so the area must stay closed (503); with them it
    // would redirect to sign in. In neither case does a page with content come back.
    for (const path of [
      "/admin",
      "/admin/sitio",
      "/admin/conversaciones",
      "/admin/ia",
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([302, 307, 401, 403, 503], path).toContain(response.status());
      expect(await response.text()).not.toContain("Administración");
    }
  });

  test("answers the admin API with an error, not data", async ({ request }) => {
    for (const method of ["get", "post"]) {
      const response = await request[/** @type {"get" | "post"} */ (method)](
        "/api/admin/sign-out",
        { maxRedirects: 0 },
      );
      expect([401, 403, 404, 405, 503]).toContain(response.status());
    }
  });

  test("does not give the analytics numbers to a visitor who is not signed in", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/admin/analytics?from=2026-10-29&to=2026-10-30",
      { maxRedirects: 0 },
    );
    expect([401, 403, 503]).toContain(response.status());
    expect(await response.text()).not.toContain("visitors");
  });

  test("never lets search engines index it", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("is not in the sitemap or in robots.txt", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    const robots = await (await request.get("/robots.txt")).text();
    expect(sitemap).not.toContain("/admin");
    expect(robots).not.toContain("/admin");
  });

  test("the public pages load no Clerk script and set no cookie", async ({
    page,
    context,
  }) => {
    /** @type {string[]} */
    const hosts = [];
    page.on("request", (request) => hosts.push(new URL(request.url()).host));
    await page.goto("/");
    expect(hosts.some((host) => /clerk/i.test(host))).toBe(false);
    expect(await context.cookies()).toEqual([]);
  });
});
