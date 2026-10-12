/**
 * Helpers for search engine and social sharing data.
 * @module utils/seo
 */

/** Towns of the Monterrey metropolitan area where the service is offered. */
export const serviceAreaCities = [
  "Monterrey",
  "San Pedro Garza García",
  "San Nicolás de los Garza",
  "Guadalupe",
  "Apodaca",
  "Santa Catarina",
  "General Escobedo",
];

/**
 * Builds a full web address for a path of the site.
 * @param {string} path - A path starting with `/`, for example `/en/contact`.
 * @param {string} base - The site address, for example `https://example.com`.
 * @returns {string} The full address.
 */
export function absoluteUrl(path, base) {
  return new URL(path, base).href;
}

/**
 * Removes the trailing slash of a path, except for the home page.
 * @param {string} path - A path starting with `/`.
 * @returns {string} The path without a trailing slash (`/` stays `/`).
 */
export function trimTrailingSlash(path) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * Builds the structured data (schema.org) that describes the business for Google.
 * @param {object} options - What to describe.
 * @param {"es" | "en"} options.lang - Language of the texts.
 * @param {{ name: string, phone: string, hours: { opens: string, closes: string }, foundedYear: number, url: string, socials: { instagram: string, facebook: string }, city: string, region: string }} options.site - The site configuration.
 * @param {{ name: string, description: string }[]} options.services - The services, already in the right language.
 * @param {string} options.description - Short description of the business.
 * @returns {Record<string, unknown>} The JSON-LD object.
 */
export function buildLocalBusiness({ lang, site, services, description }) {
  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${site.url}/#business`,
    name: site.name,
    url: site.url,
    description,
    inLanguage: lang,
    logo: absoluteUrl("/icon-512.png", site.url),
    image: absoluteUrl("/og-image.jpg", site.url),
    telephone: site.phone,
    foundingDate: String(site.foundedYear),
    address: {
      "@type": "PostalAddress",
      addressLocality: site.city,
      addressRegion: "Nuevo León",
      addressCountry: "MX",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: site.hours.opens,
      closes: site.hours.closes,
    },
    areaServed: serviceAreaCities.map((name) => ({ "@type": "City", name })),
    sameAs: [site.socials.instagram, site.socials.facebook],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: lang === "es" ? "Servicios" : "Services",
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          description: service.description,
        },
      })),
    },
  };
}

/**
 * Turns data into JSON that is safe to place inside a `<script>` tag: every `<`
 * is written as `\u003c`, so no value can ever close the tag or open another one.
 * Parsing the result gives back exactly the same data.
 * @param {unknown} data - The structured data to write.
 * @returns {string} JSON text without any `<` character.
 */
export function toSafeJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
