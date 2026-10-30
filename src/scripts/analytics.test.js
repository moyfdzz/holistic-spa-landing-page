import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  eventForLink,
  initAnalytics,
  readOptOut,
  shouldTrack,
  whatsappPlacement,
} from "./analytics.js";
import { track } from "../utils/track.js";

const allowed = {
  hostname: "www.example.com",
  productionHost: "www.example.com",
  doNotTrack: false,
  globalPrivacyControl: false,
  optedOut: false,
};

describe("shouldTrack", () => {
  it("allows a normal visit to the production site", () => {
    expect(shouldTrack(allowed)).toBe(true);
  });

  it("never tracks previews, local runs or other hosts", () => {
    expect(shouldTrack({ ...allowed, hostname: "localhost" })).toBe(false);
    expect(
      shouldTrack({ ...allowed, hostname: "abc.example.workers.dev" }),
    ).toBe(false);
    expect(shouldTrack({ ...allowed, productionHost: "" })).toBe(false);
  });

  it("respects Do Not Track, Global Privacy Control and the opt-out", () => {
    expect(shouldTrack({ ...allowed, doNotTrack: true })).toBe(false);
    expect(shouldTrack({ ...allowed, globalPrivacyControl: true })).toBe(false);
    expect(shouldTrack({ ...allowed, optedOut: true })).toBe(false);
  });
});

describe("readOptOut", () => {
  /** @returns {Pick<Storage, "getItem" | "setItem" | "removeItem">} A tiny in-memory storage. */
  function memory() {
    /** @type {Record<string, string>} */
    const data = {};
    return {
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        data[key] = value;
      },
      removeItem: (key) => {
        delete data[key];
      },
    };
  }

  it("is off by default, on with ?notrack and off again with ?notrack=0", () => {
    const store = memory();
    expect(readOptOut("", store)).toBe(false);
    expect(readOptOut("?notrack", store)).toBe(true);
    expect(readOptOut("", store)).toBe(true);
    expect(readOptOut("?notrack=0", store)).toBe(false);
  });

  it("does not fail when the storage is blocked", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readOptOut("", broken)).toBe(false);
  });
});

describe("eventForLink", () => {
  /**
   * @param {string} html - Markup of one link inside a page.
   * @returns {Element} The link.
   */
  function link(html) {
    document.body.innerHTML = html;
    return /** @type {Element} */ (document.querySelector("a"));
  }

  it("recognizes WhatsApp links and where they are", () => {
    expect(
      eventForLink(
        link('<a href="https://wa.me/5281" data-whatsapp-button></a>'),
      ),
    ).toEqual({ type: "whatsapp_click", props: { placement: "floating" } });
    expect(
      eventForLink(link('<a href="https://wa.me/5281" data-quote></a>')),
    ).toEqual({ type: "whatsapp_click", props: { placement: "service_card" } });
    expect(
      eventForLink(link('<footer><a href="https://wa.me/5281"></a></footer>')),
    ).toEqual({ type: "whatsapp_click", props: { placement: "footer" } });
    expect(
      whatsappPlacement(
        link('<div class="hero"><a href="https://wa.me/5281"></a></div>'),
      ),
    ).toBe("hero");
    expect(whatsappPlacement(link('<a href="https://wa.me/5281"></a>'))).toBe(
      "contact",
    );
  });

  it("recognizes phone, email, social and language links", () => {
    expect(eventForLink(link('<a href="tel:+528180171904"></a>'))?.type).toBe(
      "phone_click",
    );
    expect(eventForLink(link('<a href="mailto:a@b.c"></a>'))?.type).toBe(
      "email_click",
    );
    expect(
      eventForLink(link('<a href="https://www.instagram.com/x/"></a>')),
    ).toEqual({ type: "social_click", props: { network: "instagram" } });
    expect(
      eventForLink(link('<a href="/en/" data-lang-link="en"></a>')),
    ).toEqual({ type: "language_switch", props: { to: "en" } });
  });

  it("ignores any other link", () => {
    expect(eventForLink(link('<a href="/contact"></a>'))).toBeNull();
  });
});

describe("initAnalytics", () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let beacon;

  beforeEach(() => {
    document.head.innerHTML =
      '<meta name="analytics-host" content="localhost" />';
    document.body.innerHTML = '<a id="w" href="https://wa.me/5281"></a>';
    document.documentElement.lang = "es";
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a page view, link clicks and events from islands", async () => {
    expect(initAnalytics()).toBe(true);
    /** @type {Array<Record<string, unknown>>} */
    const sent = [];
    const readBlobs = async () => {
      for (const [, blob] of beacon.mock.calls) {
        sent.push(JSON.parse(await /** @type {Blob} */ (blob).text()));
      }
    };
    document.getElementById("w")?.click();
    track("form_start");
    await readBlobs();
    expect(sent.map((event) => event.type)).toEqual([
      "page_view",
      "whatsapp_click",
      "form_start",
    ]);
    expect(sent[0]).toMatchObject({ locale: "es", path: "/" });
    expect(JSON.stringify(sent)).not.toMatch(/value|password|@/);
  });

  it("does nothing when Do Not Track is on", () => {
    Object.defineProperty(navigator, "doNotTrack", {
      value: "1",
      configurable: true,
    });
    expect(initAnalytics()).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "doNotTrack", {
      value: null,
      configurable: true,
    });
  });

  describe("speed of the page", () => {
    /**
     * Puts a fake `PerformanceObserver` on the window that reports a first contentful paint.
     * @param {boolean} [supported] - Whether the browser has `PerformanceObserver`.
     * @returns {void}
     */
    const fakeObserver = (supported = true) => {
      if (!supported) {
        vi.stubGlobal("PerformanceObserver", undefined);
        Reflect.deleteProperty(window, "PerformanceObserver");
        return;
      }
      class Observer {
        /** @param {(list: { getEntries: () => object[] }) => void} callback - Entries receiver. */
        constructor(callback) {
          this.callback = callback;
        }
        /** @param {{ type: string }} init - What to watch. */
        observe(init) {
          if (init.type === "paint")
            this.callback({
              getEntries: () => [
                { name: "first-contentful-paint", startTime: 640 },
              ],
            });
        }
      }
      Object.defineProperty(window, "PerformanceObserver", {
        value: Observer,
        configurable: true,
        writable: true,
      });
    };

    /** @returns {Promise<Array<Record<string, unknown>>>} What was sent so far. */
    const sentEvents = async () => {
      /** @type {Array<Record<string, unknown>>} */
      const sent = [];
      for (const [, blob] of beacon.mock.calls)
        sent.push(JSON.parse(await /** @type {Blob} */ (blob).text()));
      return sent;
    };

    it("reports the speed once, when the page is hidden", async () => {
      fakeObserver();
      initAnalytics();
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
      const vitals = (await sentEvents()).filter(
        (event) => event.type === "web_vital",
      );
      expect(vitals).toHaveLength(1);
      expect(vitals[0].props).toEqual({ fcp: 640 });
    });

    it("sends nothing about speed when the browser measured nothing", async () => {
      fakeObserver(false);
      initAnalytics();
      window.dispatchEvent(new Event("pagehide"));
      const types = (await sentEvents()).map((event) => event.type);
      expect(types).not.toContain("web_vital");
    });

    it("does not report the speed of a visit it may not measure", () => {
      fakeObserver();
      localStorage.setItem("analytics-optout", "1");
      expect(initAnalytics()).toBe(false);
      window.dispatchEvent(new Event("pagehide"));
      expect(beacon).not.toHaveBeenCalled();
    });
  });
});
