/**
 * Validation of the contact form. Pure functions, no browser needed.
 * @module utils/contactValidation
 */
import { useTranslations } from "../i18n/utils.js";

/** Longest message accepted, in characters. */
export const MESSAGE_MAX_LENGTH = 1000;

/** Longest name accepted, in characters. */
export const NAME_MAX_LENGTH = 100;

/**
 * @typedef {object} ContactValues
 * @property {string} name - Full name.
 * @property {string} email - Email address.
 * @property {string} phone - Phone number, with or without spaces, dashes and parentheses.
 * @property {string} message - Free text message.
 * @property {"email" | "whatsapp" | "phone"} method - How the person wants to be contacted.
 * @property {boolean} consent - Whether the privacy notice was accepted.
 */

/**
 * @typedef {"name" | "email" | "phone" | "message" | "consent"} ContactField
 */

/**
 * Cleans a Mexican phone number to its 10 digits.
 * Spaces, dashes, dots and parentheses are ignored, and a `+52` or `52` country prefix is removed.
 * @param {string} value - The phone number as typed.
 * @returns {string} The digits, for example `8180171904`. Anything that is not a valid number is returned as the cleaned text.
 */
export function normalizePhone(value) {
  const cleaned = value.replace(/[\s().-]/g, "");
  const withoutPlus = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return /^52\d{10}$/.test(withoutPlus) ? withoutPlus.slice(2) : withoutPlus;
}

/**
 * Checks that an email looks like `name@domain.tld`.
 * @param {string} value - The email.
 * @returns {boolean} True when it looks valid.
 */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Validates the contact form.
 * The phone is required for WhatsApp and phone calls, the email is required for email,
 * and either one must be well formed when it is filled in.
 * @param {ContactValues} values - What the person typed.
 * @param {"es" | "en"} lang - Language of the error messages.
 * @returns {{ valid: boolean, errors: Partial<Record<ContactField, string>> }} The result and one message per wrong field.
 */
export function validateContactForm(values, lang) {
  const t = useTranslations(lang);
  /** @type {Partial<Record<ContactField, string>>} */
  const errors = {};

  const name = values.name.trim();
  if (!name) errors.name = t("contact.errors.nameRequired");
  else if (name.length > NAME_MAX_LENGTH) {
    errors.name = t("contact.errors.nameTooLong", { max: NAME_MAX_LENGTH });
  }

  const email = values.email.trim();
  if (values.method === "email" && !email) {
    errors.email = t("contact.errors.emailRequired");
  } else if (email && !isValidEmail(email)) {
    errors.email = t("contact.errors.emailInvalid");
  }

  const phone = values.phone.trim();
  if (values.method !== "email" && !phone) {
    errors.phone = t("contact.errors.phoneRequired");
  } else if (phone && !/^\d{10}$/.test(normalizePhone(phone))) {
    errors.phone = t("contact.errors.phoneInvalid");
  }

  if (values.message.length > MESSAGE_MAX_LENGTH) {
    errors.message = t("contact.errors.messageTooLong", {
      max: MESSAGE_MAX_LENGTH,
    });
  }

  if (!values.consent) errors.consent = t("contact.errors.consentRequired");

  return { valid: Object.keys(errors).length === 0, errors };
}
