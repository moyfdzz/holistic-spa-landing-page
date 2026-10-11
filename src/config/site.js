/**
 * Business data used across the site. Edit this file to change the name,
 * phone, service area or social links everywhere at once.
 * @module config/site
 */

/**
 * @typedef {object} SiteConfig
 * @property {string} name - Full business name.
 * @property {string} shortName - Short name for small spaces (app icon, tabs).
 * @property {{ es: string, en: string }} tagline - Short slogan in each language.
 * @property {string} phone - Phone number in international format, as shown to visitors.
 * @property {string} whatsapp - WhatsApp number in international format.
 * @property {string} area - Service area, as shown to visitors.
 * @property {string} city - City of the service area.
 * @property {string} region - State and country of the service area.
 * @property {{ opens: string, closes: string }} hours - Opening hours, every day, as `HH:MM` in 24-hour time.
 * @property {number} foundedYear - Year the business started.
 * @property {{ instagram: string, facebook: string }} socials - Social media profile URLs.
 * @property {string} url - Production address of the site, without a trailing slash.
 */

/** @type {SiteConfig} */
export const site = {
  name: "Masajes Relax Monterrey",
  shortName: "Masajes Relax",
  tagline: {
    es: "Tu momento de calma, a domicilio",
    en: "Your moment of calm, at your door",
  },
  phone: "+52 81 8017 1904",
  whatsapp: "+52 81 8017 1904",
  area: "Monterrey, Nuevo León, México",
  city: "Monterrey",
  region: "Nuevo León, México",
  hours: { opens: "08:00", closes: "22:00" },
  foundedYear: 2017,
  socials: {
    instagram: "https://www.instagram.com/masajesrelax.mty/",
    facebook: "https://www.facebook.com/masajesrelax.mty",
  },
  // Stays on the old address until the domain is moved (REL-26).
  url: "https://masajes-rossy.vercel.app",
};
