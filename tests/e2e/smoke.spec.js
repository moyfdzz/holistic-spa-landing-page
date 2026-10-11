import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("loads with the main sections and a single h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    for (const id of ["#home", "#about", "#services", "#FAQ"]) {
      await expect(page.locator(id)).toBeAttached();
    }
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("navigation link scrolls to its section", async ({ page, isMobile }) => {
    test.skip(isMobile, "the navigation is inside the mobile menu on phones");
    await page.goto("/");
    await page
      .locator("header")
      .getByRole("link", { name: "Servicios" })
      .click();
    await expect(page).toHaveURL(/#services$/);
    await expect(page.locator("#services")).toBeInViewport();
  });

  test("mobile menu opens, can be used with the keyboard and closes", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the menu button only exists on phones");
    await page.goto("/");
    const toggle = page.locator("[data-nav-toggle]");
    const menu = page.getByRole("navigation", { name: "Principal" });
    await expect(menu).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Contacto" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("mobile menu link navigates and closes the menu", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the menu button only exists on phones");
    await page.goto("/");
    await page.locator("[data-nav-toggle]").click();
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Preguntas" })
      .click();
    await expect(page).toHaveURL(/#FAQ$/);
    await expect(
      page.getByRole("navigation", { name: "Principal" }),
    ).toBeHidden();
  });

  test("FAQ answer opens and closes", async ({ page }) => {
    await page.goto("/");
    const question = page.getByRole("button", { name: /Qué tipos de masajes/ });
    const answer = page.locator("#answer1");
    await question.scrollIntoViewIfNeeded();
    await expect(answer).toBeHidden();

    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(answer).toBeVisible();

    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await expect(answer).toBeHidden();
  });

  test("services carousel moves with its arrows", async ({ page }) => {
    await page.goto("/");
    const active = page.locator(".swiper-slide-active .service-card__name");
    await page.locator("#services").scrollIntoViewIfNeeded();
    const before = await active.first().textContent();

    await page.getByRole("button", { name: "Servicio siguiente" }).click();
    await expect(active.first()).not.toHaveText(before ?? "");
  });
});

test.describe("contact page", () => {
  test("loads with a labelled contact form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("#contact-form")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(
      page.getByLabel("Correo Electrónico", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("¿Qué tienes en mente?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();
  });
});

test.describe("responsive layout", () => {
  for (const path of ["/", "/contact"]) {
    test(`no horizontal scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});

test.describe("motion and scripts", () => {
  test("content is visible without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "¿Por qué elegirnos?" }),
    ).toBeVisible();
    await context.close();
  });

  test("content is visible straight away with reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Por qué elegirnos?" }))
      .toBeInViewport({
        ratio: 0,
      })
      .catch(() => {});
    const opacity = await page
      .locator("#about [data-reveal]")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});

// To be completed in their feature tickets.
test.fixme("language switch changes the page language (REL-14)", async () => {});
test.fixme("contact form shows inline validation errors (REL-19)", async () => {});
