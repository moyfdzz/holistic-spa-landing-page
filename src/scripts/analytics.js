/**
 * Anonymous, cookieless statistics. Sends small events to `/api/collect` (see docs/analytics.md).
 * It stores nothing in the browser except an opt-out flag the owner can set, respects Do Not
 * Track and Global Privacy Control, and never sends what a visitor types.
 * @module scripts/analytics
 */
import { TRACK_EVENT } from "../utils/track.js";

const ENDPOINT = "/api/collect";
const OPT_OUT_KEY = "analytics-optout";

/**
 * Decides whether this visit may be measured.
 * @param {object} input - The facts.
 * @param {string} input.hostname - Host of the current page.
 * @param {string} input.productionHost - Host of the production site.
 * @param {boolean} input.doNotTrack - Do Not Track is on.
 * @param {boolean} input.globalPrivacyControl - Global Privacy Control is on.
 * @param {boolean} input.optedOut - The owner turned the tracker off in this browser.
 * @returns {boolean} True when events may be sent.
 */
export function shouldTrack({
  hostname,
  productionHost,
  doNotTrack,
  globalPrivacyControl,
  optedOut,
}) {
  return (
    hostname === productionHost &&
    !doNotTrack &&
    !globalPrivacyControl &&
    !optedOut
  );
}

/**
 * Reads the opt-out flag, and sets or clears it when the address has `?notrack` or `?notrack=0`.
 * This lets the owner exclude their own visits without a cookie.
 * @param {string} search - The query string of the page.
 * @param {Pick<Storage, "getItem" | "setItem" | "removeItem">} [storage] - Where the flag lives.
 * @returns {boolean} True when this browser is opted out.
 */
export function readOptOut(search, storage) {
  try {
    const store = storage ?? localStorage;
    const flag = new URLSearchParams(search).get("notrack");
    if (flag === "0") store.removeItem(OPT_OUT_KEY);
    else if (flag !== null) store.setItem(OPT_OUT_KEY, "1");
    return store.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Names the place of a WhatsApp link on the page.
 * @param {Element} link - The link that was clicked.
 * @returns {string} The placement.
 */
export function whatsappPlacement(link) {
  if (link.closest("[data-whatsapp-button]")) return "floating";
  if (link.hasAttribute("data-quote")) return "service_card";
  if (link.closest("footer")) return "footer";
  if (link.closest(".hero")) return "hero";
  return "contact";
}

/**
 * Turns a click on a link into an event, or null when the link is not interesting.
 * @param {Element} link - The link that was clicked.
 * @returns {{ type: string, props?: Record<string, string> } | null} The event.
 */
export function eventForLink(link) {
  const href = link.getAttribute("href") ?? "";
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href))
    return {
      type: "whatsapp_click",
      props: { placement: whatsappPlacement(link) },
    };
  if (href.startsWith("tel:")) return { type: "phone_click" };
  if (href.startsWith("mailto:")) return { type: "email_click" };
  const social = /^https?:\/\/(www\.)?(instagram|facebook)\.com\//.exec(href);
  if (social) return { type: "social_click", props: { network: social[2] } };
  if (link.hasAttribute("data-lang-link"))
    return {
      type: "language_switch",
      props: { to: link.getAttribute("data-lang-link") ?? "" },
    };
  return null;
}

/**
 * Starts the tracker.
 * @param {Window & typeof globalThis} [win] - The window to work on.
 * @returns {boolean} True when the tracker is running.
 */
export function initAnalytics(win = window) {
  const doc = win.document;
  const productionHost =
    doc.querySelector('meta[name="analytics-host"]')?.getAttribute("content") ??
    "";
  const nav = /** @type {Navigator & { globalPrivacyControl?: boolean }} */ (
    win.navigator
  );
  if (
    !shouldTrack({
      hostname: win.location.hostname,
      productionHost,
      doNotTrack:
        nav.doNotTrack === "1" ||
        /** @type {Window & { doNotTrack?: string }} */ (win).doNotTrack ===
          "1",
      globalPrivacyControl: nav.globalPrivacyControl === true,
      optedOut: readOptOut(win.location.search),
    })
  )
    return false;

  const params = new URLSearchParams(win.location.search);
  const base = {
    path: win.location.pathname,
    locale: doc.documentElement.lang === "en" ? "en" : "es",
    referrer: doc.referrer.slice(0, 300) || undefined,
    utmSource: params.get("utm_source")?.slice(0, 80) || undefined,
    utmMedium: params.get("utm_medium")?.slice(0, 80) || undefined,
    utmCampaign: params.get("utm_campaign")?.slice(0, 80) || undefined,
    screenWidth: Math.round(win.innerWidth),
  };

  /**
   * Sends one event without blocking the page.
   * @param {string} type - Event name.
   * @param {Record<string, string | number | boolean>} [props] - A few short values.
   */
  const send = (type, props) => {
    const body = JSON.stringify({ ...base, type, props });
    const sent =
      typeof win.navigator.sendBeacon === "function" &&
      win.navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
    if (!sent) {
      win
        .fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        })
        .catch(() => {});
    }
  };

  send("page_view");
  if (/\/contact$/.test(base.path)) send("contact_view");

  // Clicks on links.
  doc.addEventListener(
    "click",
    (event) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      const found = link && eventForLink(link);
      if (found) send(found.type, found.props);
    },
    true,
  );

  // Events from islands (the contact form).
  doc.addEventListener(TRACK_EVENT, (event) => {
    const { type, props } = /** @type {CustomEvent} */ (event).detail ?? {};
    if (typeof type === "string") send(type, props);
  });

  // Questions opened in the FAQ.
  doc.addEventListener(
    "toggle",
    (event) => {
      const el = event.target;
      if (
        el instanceof HTMLDetailsElement &&
        el.open &&
        el.id.startsWith("faq-")
      )
        send("faq_open", { id: el.id.slice(4) });
    },
    true,
  );

  // Sections and service cards that come into view, once each.
  if ("IntersectionObserver" in win) {
    const seen = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = /** @type {HTMLElement} */ (entry.target);
          const service = el.getAttribute("data-service");
          const key = service ? `service:${service}` : `section:${el.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          observer.unobserve(el);
          if (service) send("service_card_view", { id: service });
          else send("section_view", { section: el.id });
        }
      },
      { threshold: 0.4 },
    );
    doc
      .querySelectorAll(
        "#about, #services, #testimonials, #FAQ, [data-service]",
      )
      .forEach((el) => observer.observe(el));
  }

  // Time on the page (only while the tab is visible) and how far it was scrolled.
  let visibleSince = doc.visibilityState === "visible" ? Date.now() : 0;
  let maxScroll = 0;
  const updateScroll = () => {
    const room = doc.documentElement.scrollHeight - win.innerHeight;
    const depth = room > 0 ? (win.scrollY / room) * 100 : 100;
    maxScroll = Math.max(maxScroll, depth);
  };
  win.addEventListener("scroll", updateScroll, { passive: true });
  const flush = () => {
    updateScroll();
    if (!visibleSince) return;
    const seconds = Math.round((Date.now() - visibleSince) / 1000);
    visibleSince = 0;
    if (seconds < 1) return;
    const scroll = [100, 75, 50, 25, 0].find((step) => maxScroll >= step) ?? 0;
    send("engagement", { seconds: Math.min(seconds, 3600), scroll });
  };
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") flush();
    else visibleSince = Date.now();
  });
  win.addEventListener("pagehide", flush);

  return true;
}

if (typeof window !== "undefined") initAnalytics();
