import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/en/",
  "/contact",
  "/en/contact",
  "/aviso-de-privacidad",
  "/en/privacy-notice",
  // Any address that does not exist shows the 404 page.
  "/no-existe",
  "/en/no-such-page",
];

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Runs the accessibility checks on the open page.
 * @param {import("@playwright/test").Page} page - The page to check.
 * @returns {Promise<string[]>} One line per serious or critical problem. Empty when there are none.
 */
async function seriousProblems(page) {
  // Without the fade-in animations, colors are measured at their final value.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} -> ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
}

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const path of pages) {
    test(`no serious or critical problems on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await seriousProblems(page)).toEqual([]);
    });
  }

  test("no serious problems with the FAQ open and the form errors showing", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator("#faq-types").evaluate((el) => {
      /** @type {HTMLDetailsElement} */ (el).open = true;
    });
    expect(await seriousProblems(page)).toEqual([]);

    await page.goto("/contact");
    await page.getByRole("button", { name: "Enviar" }).click();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test("no serious problems with the mobile menu open", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the menu only exists on phones");
    await page.goto("/");
    await page.locator("[data-nav-toggle]").click();
    expect(await seriousProblems(page)).toEqual([]);
  });
});

test.describe("page structure", () => {
  for (const path of pages) {
    test(`${path} has one h1, a main landmark and a skip link`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("a.skip-link")).toHaveAttribute(
        "href",
        "#main",
      );
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang).toBe(
        path.startsWith("/en") || path.includes("privacy-notice") ? "en" : "es",
      );
    });
  }

  // WCAG 2.5.3: someone who controls the page by voice says what they see.
  test("the language links are named starting with the code they show", async ({
    page,
  }) => {
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      const links = page.locator(".lang__link");
      await expect(links).toHaveCount(2);
      for (const [i, name] of ["ES Español", "EN English"].entries()) {
        const link = links.nth(i);
        await expect(link).toHaveAccessibleName(name);
        // The full name is only for screen readers: the header shows the code.
        await expect(link.locator(".visually-hidden")).toHaveCSS(
          "width",
          "1px",
        );
      }
    }
  });

  test("the skip link is the first thing reached with the keyboard and works", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "keyboard navigation is checked on desktop");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });
});

test.describe("keyboard", () => {
  test("the mobile menu keeps focus inside while open", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the menu only exists on phones");
    await page.goto("/");
    await page.locator("[data-nav-toggle]").click();
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () =>
          Boolean(document.activeElement?.closest("[data-header]")) ||
          document.activeElement === document.body,
      );
      expect(inside).toBe(true);
    }
  });

  test("focus is always visible on links and buttons", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "keyboard navigation is checked on desktop");
    await page.goto("/");
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return true;
        const style = getComputedStyle(el);
        return (
          (style.outlineStyle !== "none" &&
            parseFloat(style.outlineWidth) > 0) ||
          style.boxShadow !== "none"
        );
      });
      expect(visible).toBe(true);
    }
  });
});

test.describe("touch targets and zoom", () => {
  test("buttons and links outside of text are at least 44 x 44 px on a phone", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "touch targets matter on phones");
    await page.goto("/");
    await page.locator("[data-nav-toggle]").waitFor();
    const small = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          "button, a.btn, .lang__link, .nav-toggle, .accordion__button, .service-card a, .whatsapp, .footer a",
        ),
      )
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.width > 0 &&
            box.height > 0 &&
            getComputedStyle(el).visibility !== "hidden" &&
            !el.closest("[hidden]") &&
            (box.width < 44 || box.height < 44)
          );
        })
        .map((el) => {
          const box = el.getBoundingClientRect();
          return `${el.tagName.toLowerCase()}.${el.className} ${Math.round(box.width)}x${Math.round(box.height)}`;
        }),
    );
    expect(small).toEqual([]);
  });

  for (const [width, height] of [
    [360, 740],
    [390, 844],
    [414, 896],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1440, 900],
    [844, 390],
    [320, 640],
  ]) {
    test(`no horizontal scrolling at ${width} x ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      for (const path of pages) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
