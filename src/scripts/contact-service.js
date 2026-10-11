/**
 * Preselects the service in the contact form from a `?service=<slug>` link.
 * @module scripts/contact-service
 */

/**
 * Picks the option of the service select that matches the `service` value in the address.
 * Unknown values are ignored.
 * @param {Document} [root] - The document to work on.
 * @param {string} [search] - The query string, for example `?service=shiatsu`.
 * @returns {boolean} True when an option was selected.
 */
export function preselectService(
  root = document,
  search = globalThis.location?.search ?? "",
) {
  const select = /** @type {HTMLSelectElement | null} */ (
    root.querySelector("[data-service-select]")
  );
  const slug = new URLSearchParams(search).get("service");
  if (!select || !slug) return false;
  const exists = Array.from(select.options).some((o) => o.value === slug);
  if (!exists) return false;
  select.value = slug;
  return true;
}
