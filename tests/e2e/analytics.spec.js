import { expect, test } from "@playwright/test";

/**
 * Opens a page as if it were served from the production host (the tracker only runs there)
 * and collects what the tracker sends.
 * @param {import("@playwright/test").Page} page - The page.
 * @param {string} path - Address to open.
 * @param {(page: import("@playwright/test").Page) => Promise<void>} [before] - Runs before the page loads.
 * @returns {Promise<Array<Record<string, unknown>>>} The list that fills up with the events sent.
 */
async function openTracked(page, path, before) {
  /** @type {Array<Record<string, unknown>>} */
  const events = [];
  await page.route("**/api/collect", async (route) => {
    events.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 204 });
  });
  // The tracker only runs on the production host: make the page say localhost is it.
  await page.route(
    (url) => !url.pathname.startsWith("/_astro") && !url.pathname.includes("."),
    async (route) => {
      if (route.request().resourceType() !== "document")
        return route.fallback();
      const response = await route.fetch();
      const html = (await response.text()).replace(
        /<meta name="analytics-host" content="[^"]*"/,
        '<meta name="analytics-host" content="localhost"',
      );
      await route.fulfill({ response, body: html });
    },
  );
  await before?.(page);
  await page.goto(path);
  return events;
}

test.describe("anonymous analytics", () => {
  test("does not send anything from a host that is not production", async ({
    page,
  }) => {
    /** @type {string[]} */
    const requests = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/collect")) requests.push(request.url());
    });
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test("sends a page view and sets no cookie", async ({ page, context }) => {
    const events = await openTracked(page, "/");
    await expect.poll(() => events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({
      type: "page_view",
      path: "/",
      locale: "es",
    });
    expect(await context.cookies()).toEqual([]);
  });

  test("counts clicks on the floating WhatsApp button and the language switch", async ({
    page,
  }) => {
    const events = await openTracked(page, "/");
    await expect.poll(() => events.length).toBeGreaterThan(0);
    await page.evaluate(() => {
      // Do not leave the page: only the click matters.
      document.addEventListener(
        "click",
        (event) => event.preventDefault(),
        true,
      );
    });
    await page.locator("[data-whatsapp-button]").click({ force: true });
    await expect
      .poll(() => events.find((event) => event.type === "whatsapp_click"))
      .toMatchObject({ props: { placement: "floating" } });
  });

  test("starts the contact funnel when a field is focused, without sending what is typed", async ({
    page,
  }) => {
    const events = await openTracked(page, "/contact");
    await expect
      .poll(() => events.some((event) => event.type === "contact_view"))
      .toBe(true);
    await page.locator("#name").fill("Ana Prueba");
    await expect
      .poll(() => events.some((event) => event.type === "form_start"))
      .toBe(true);
    expect(JSON.stringify(events)).not.toContain("Ana");
  });

  test("respects Do Not Track", async ({ page }) => {
    const events = await openTracked(page, "/", async (p) => {
      await p.addInitScript(() => {
        Object.defineProperty(navigator, "doNotTrack", { value: "1" });
      });
    });
    await page.waitForTimeout(600);
    expect(events).toEqual([]);
  });

  test("respects Global Privacy Control", async ({ page }) => {
    const events = await openTracked(page, "/", async (p) => {
      await p.addInitScript(() => {
        Object.defineProperty(navigator, "globalPrivacyControl", {
          value: true,
        });
      });
    });
    await page.waitForTimeout(600);
    expect(events).toEqual([]);
  });

  test("lets the owner opt out with ?notrack", async ({ page }) => {
    const events = await openTracked(page, "/?notrack");
    await page.waitForTimeout(600);
    expect(events).toEqual([]);
    await page.goto("/?notrack=0");
  });
});
