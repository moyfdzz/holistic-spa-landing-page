import { expect, test } from "@playwright/test";

test.describe("admin area", () => {
  test("is closed to a visitor who is not signed in", async ({ request }) => {
    // The test server has no Clerk settings, so the area must stay closed (503); with them it
    // would redirect to sign in. In neither case does a page with content come back.
    for (const path of ["/admin", "/admin/sitio"]) {
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

  test("does not give the CSV export to a visitor who is not signed in", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/admin/analytics/export?table=series&from=2026-10-29&to=2026-10-30",
      { maxRedirects: 0 },
    );
    expect([401, 403, 503]).toContain(response.status());
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
  });

  // Astro decodes and tidies an address before it picks the page, so the guard has to
  // judge the same address.
  test("stays closed however the address is written", async ({
    request,
    baseURL,
  }) => {
    // A complete query: a request that got through would then reach the database.
    const query = "from=2026-10-29&to=2026-10-30&granularity=day";
    for (const path of [
      "//admin",
      "///admin/sitio",
      "//admin//sitio",
      "/%61dmin",
      "/%61dmin/sitio",
      "/admin%2Fsitio",
      "/%2561dmin",
      "/%5Cadmin",
      "/admin.html",
      "/admin/index.html",
      "/admin/sitio.html",
      `//api/admin/analytics?${query}`,
      `/api/%61dmin/analytics?${query}`,
      `/%61pi/admin/analytics?${query}`,
      `/api//admin/analytics?${query}`,
      `//api/admin/analytics/export?table=series&${query}`,
    ]) {
      // The whole address: a path that starts with // would be read as another host.
      const response = await request.get(`${baseURL}${path}`, {
        maxRedirects: 0,
      });
      expect([302, 307, 401, 403, 404, 503], path).toContain(response.status());
      const body = await response.text();
      // That exact text is the second check of a page or endpoint: seeing it would mean the
      // middleware did not recognise the address.
      expect(body, path).not.toBe("Unauthorized");
      expect(body, path).not.toContain("Administración");
      expect(body, path).not.toContain("visitors");
      expect(response.headers()["content-type"] ?? "", path).not.toContain(
        "text/csv",
      );
    }
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
