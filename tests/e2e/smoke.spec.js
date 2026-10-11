import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("loads with the main sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    for (const id of ["#home", "#about", "#services", "#FAQ"]) {
      await expect(page.locator(id)).toBeAttached();
    }
  });

  test("navigation link scrolls to its section", async ({ page, isMobile }) => {
    test.skip(isMobile, "the navigation is inside the mobile menu on phones");
    await page.goto("/");
    await page.locator("#services-link").click();
    await expect(page).toHaveURL(/#services$/);
    await expect(page.locator("#services")).toBeInViewport();
  });

  test("mobile menu opens and closes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the menu button only exists on phones");
    await page.goto("/");
    const menu = page.locator(".nav__links");
    await expect(menu).not.toHaveClass(/active/);

    await page.locator(".show-menu").click();
    await expect(menu).toHaveClass(/active/);

    await page.locator(".close-menu").click();
    await expect(menu).not.toHaveClass(/active/);
  });

  test("FAQ answer opens and closes", async ({ page }) => {
    await page.goto("/");
    const item = page.locator("#question1");
    await item.scrollIntoViewIfNeeded();
    await item.locator(".accordion__link").click();
    await expect(item).toHaveClass(/active/);
    await item.locator(".accordion__link").click();
    await expect(item).not.toHaveClass(/active/);
  });
});

test.describe("contact page", () => {
  test("loads with the contact form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("#contact-form")).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
  });
});

// To be completed in their feature tickets.
test.fixme("language switch changes the page language (REL-14)", async () => {});
test.fixme("contact form shows inline validation errors (REL-19)", async () => {});
