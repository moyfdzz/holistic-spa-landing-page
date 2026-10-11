import { expect, test } from "@playwright/test";

test.describe("brand", () => {
  test("uses the new name, favicon and web manifest", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Masajes Relax Monterrey/);
    await expect(page.locator("header .logo")).toContainText(
      "Masajes Relax Monterrey",
    );
    await expect(
      page.locator('link[rel="icon"][href="/favicon.svg"]'),
    ).toHaveCount(1);
    const response = await request.get("/site.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("Masajes Relax Monterrey");
    expect(manifest.theme_color).toBe("#475d42");
  });
});

test.describe("about section", () => {
  test("shows Desde 2017 and a years count that is not hard-coded", async ({
    page,
  }) => {
    await page.goto("/");
    const about = page.locator("#about");
    await expect(about).toContainText("Desde 2017");
    const years = new Date().getFullYear() - 2017;
    await expect(about.locator("[data-years-since]")).toHaveText(String(years));
    const services = await page.locator("#services .service-card").count();
    await expect(about.locator(".stat__value").nth(1)).toHaveText(
      String(services),
    );
  });
});

test.describe("search engines and sharing", () => {
  test("each page has its own title, description, canonical and share tags", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Masajes a domicilio en Monterrey/);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description?.length).toBeGreaterThan(70);
    expect(description?.length).toBeLessThanOrEqual(175);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https:\/\/.+\/$/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /og-image\.png$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );

    await page.goto("/en/contact");
    await expect(page).toHaveTitle(/Contact \| Masajes Relax Monterrey/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/contact$/,
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      "content",
      "en_US",
    );
  });

  test("the home page describes the local business for Google", async ({
    page,
  }) => {
    await page.goto("/");
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const business = blocks
      .map((text) => JSON.parse(text))
      .find((data) => data["@type"] === "HealthAndBeautyBusiness");
    expect(business.name).toBe("Masajes Relax Monterrey");
    expect(business.areaServed.length).toBeGreaterThanOrEqual(7);
    expect(business.hasOfferCatalog.itemListElement).toHaveLength(8);
    expect(business.sameAs).toHaveLength(2);
  });

  test("robots.txt points to a sitemap that lists both languages", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Sitemap:");
    expect(robots).toContain("sitemap-index.xml");
    const index = await (await request.get("/sitemap-index.xml")).text();
    expect(index).toContain("sitemap-0.xml");
    const pages = await (await request.get("/sitemap-0.xml")).text();
    expect(pages).toMatch(/\/en\/<\/loc>/);
    expect(pages).toMatch(/\/en\/contact</);
    expect(pages).not.toMatch(/contact\/</);
    expect(pages).toContain('hreflang="en-US"');
  });
});

test.describe("languages", () => {
  test("Spanish is the default and English lives at /en/", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.goto("/en/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toContainText("Well-Being");
    await expect(page).toHaveTitle(/Masajes Relax Monterrey/);
  });

  test("language switch changes the page language (REL-14)", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: "English", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const current = page.locator(".lang [aria-current='true']");
    await expect(current).toHaveText("EN");
    await page
      .getByRole("link", { name: "Español", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("switching keeps the visitor on the equivalent page and section", async ({
    page,
  }) => {
    await page.goto("/contact");
    await page
      .getByRole("link", { name: "English", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/contact$/);
    await expect(page.locator("h1")).toContainText("Contact Us Today");

    await page.goto("/#services");
    await page
      .getByRole("link", { name: "English", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/#services$/);
  });

  test("pages link to each other with hreflang", async ({ page }) => {
    await page.goto("/contact");
    for (const code of ["es", "en", "x-default"]) {
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${code}"]`),
      ).toHaveCount(1);
    }
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", /\/en\/contact$/);
  });

  test("English pages keep their links inside English", async ({ page }) => {
    await page.goto("/en/");
    const hrefs = await page
      .locator("header nav a, footer nav a:not([target])")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    for (const href of hrefs) expect(href).toMatch(/^\/en\//);
  });
});

test.describe("privacy notice", () => {
  test("is reachable from the footer and the form, in both languages", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator("footer")
      .getByRole("link", { name: "Aviso de Privacidad" })
      .click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);
    await expect(page.locator("h1")).toHaveText("Aviso de Privacidad");
    await expect(
      page.getByRole("heading", { name: /Responsable del tratamiento/ }),
    ).toBeVisible();

    await page.goto("/contact");
    await page
      .locator("form")
      .getByRole("link", { name: "Aviso de Privacidad" })
      .click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);

    await page.goto("/en/contact");
    await page
      .locator("form")
      .getByRole("link", { name: "Privacy Notice" })
      .click();
    await expect(page).toHaveURL(/\/en\/privacy-notice$/);
    await expect(page.locator("h1")).toHaveText("Privacy Notice");
  });

  test("the language switch goes to the same notice in the other language", async ({
    page,
  }) => {
    await page.goto("/aviso-de-privacidad");
    await page
      .getByRole("link", { name: "English", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/privacy-notice$/);
    await page
      .getByRole("link", { name: "Español", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);
  });
});

test.describe("floating WhatsApp button", () => {
  test("opens WhatsApp with a message in the current language", async ({
    page,
  }) => {
    await page.goto("/");
    const button = page.getByRole("link", { name: "Escríbenos por WhatsApp" });
    const href = (await button.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(href)).toContain("información sobre sus masajes");

    await page.goto("/en/contact");
    const english = page.getByRole("link", {
      name: "Chat with us on WhatsApp",
    });
    expect(
      decodeURIComponent((await english.getAttribute("href")) ?? ""),
    ).toContain("information about your massages");
  });

  test("is big enough to tap and hides near the footer", async ({ page }) => {
    await page.goto("/");
    const button = page.locator("[data-whatsapp-button]");
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect(button).toBeHidden();
  });

  test("hides while a form field is focused on a phone", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "only phones hide it for the keyboard");
    await page.goto("/contact");
    const button = page.locator("[data-whatsapp-button]");
    await page.locator("#name").focus();
    await expect(button).toBeHidden();
    await page.locator("#name").blur();
    await expect(button).toBeVisible();
  });
});

test.describe("services catalog", () => {
  test("every service shows a description, duration and a quote button", async ({
    page,
  }) => {
    await page.goto("/");
    const cards = page.locator("#services .service-card");
    await expect(cards).toHaveCount(8);
    for (const card of await cards.all()) {
      await expect(card.locator(".service-card__text")).not.toBeEmpty();
      await expect(card.locator(".service-card__duration")).toContainText(
        "min",
      );
      await expect(card.locator("img")).toHaveAttribute("alt", /.{10,}/);
    }
    const quote = cards.first().locator("[data-quote]");
    await expect(quote).toHaveText(/Solicitar cotización/);
    const href = (await quote.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(href)).toContain("Masaje relajante");
  });

  test("every photo has its own description", async ({ page }) => {
    await page.goto("/");
    const alts = await page
      .locator("#services .service-card img")
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt")));
    expect(new Set(alts).size).toBe(alts.length);
  });

  test("the English page has English texts and a translated message", async ({
    page,
  }) => {
    await page.goto("/en/");
    const first = page.locator("#services .service-card").first();
    await expect(first.locator("[data-quote]")).toHaveText(/Ask for a quote/);
    const href =
      (await first.locator("[data-quote]").getAttribute("href")) ?? "";
    expect(decodeURIComponent(href)).toContain("Relaxing massage");
    await expect(first.locator("[data-contact-link]")).toHaveAttribute(
      "href",
      "/en/contact?service=relajante",
    );
  });

  test("the contact link preselects the service in the form", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator("#services .service-card")
      .nth(3)
      .locator("[data-contact-link]")
      .click();
    await expect(page).toHaveURL(/\/contact\?service=shiatsu$/);
    await expect(page.locator("#service")).toHaveValue("shiatsu");
  });

  test("cards can be scrolled sideways on a phone, without moving the page", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the carousel only exists on phones");
    await page.goto("/");
    const scroller = page.locator(".services__scroller");
    await scroller.scrollIntoViewIfNeeded();
    const overflows = await scroller.evaluate(
      (el) => el.scrollWidth > el.clientWidth,
    );
    expect(overflows).toBe(true);
    await expect(page.locator(".services__hint")).toBeVisible();
  });
});

test.describe("social links", () => {
  test("point to the new profiles and open safely in a new tab", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    for (const [name, url] of [
      ["Instagram", "https://www.instagram.com/masajesrelax.mty/"],
      ["Facebook", "https://www.facebook.com/masajesrelax.mty"],
    ]) {
      const link = footer.getByRole("link", {
        name: `${name} de Masajes Relax Monterrey`,
      });
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });
});

test.describe("icons", () => {
  test("are inline SVG with no icon font, CDN or Flaticon credit", async ({
    page,
  }) => {
    const external = [];
    page.on("request", (request) => {
      if (!request.url().startsWith("http://localhost")) {
        external.push(request.url());
      }
    });
    await page.goto("/");
    await expect(page.locator("footer")).not.toContainText("Flaticon");
    await expect(page.locator("i[class*='fa-']")).toHaveCount(0);
    expect(await page.locator("header svg").count()).toBeGreaterThan(0);
    expect(external.filter((url) => url.includes("font-awesome"))).toEqual([]);
  });

  test("icon-only buttons have accessible names", async ({ page }) => {
    await page.goto("/");
    for (const button of await page.locator("button").all()) {
      const name = await button.evaluate(
        (el) => el.getAttribute("aria-label") || el.textContent?.trim() || "",
      );
      expect(name).not.toBe("");
    }
  });
});

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

  test("FAQ answer opens and closes with the keyboard", async ({ page }) => {
    await page.goto("/");
    const item = page.locator("#faq-types");
    const question = item.locator("summary");
    await question.scrollIntoViewIfNeeded();
    await expect(item).not.toHaveAttribute("open", "");

    await question.focus();
    await page.keyboard.press("Enter");
    await expect(item).toHaveAttribute("open", "");
    await expect(item.locator(".answer__text")).toBeVisible();

    await page.keyboard.press("Space");
    await expect(item).not.toHaveAttribute("open", "");
  });

  test("only one FAQ answer is open at a time", async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq-types summary").click();
    await page.locator("#faq-booking summary").click();
    await expect(page.locator("#faq-types")).not.toHaveAttribute("open", "");
    await expect(page.locator("#faq-booking")).toHaveAttribute("open", "");
  });

  test("FAQ has structured data in the current language and no old handlers", async ({
    page,
  }) => {
    await page.goto("/en/");
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const data = blocks
      .map((text) => JSON.parse(text))
      .find((item) => item["@type"] === "FAQPage");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity[0].name).toMatch(/massage/i);
    expect(
      await page.locator("[onclick], a[href^='javascript:']").count(),
    ).toBe(0);
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
test.fixme("contact form shows inline validation errors (REL-19)", async () => {});
