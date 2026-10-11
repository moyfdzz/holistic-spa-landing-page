import { useEffect, useState } from "react";
import "./ContactForm.css";
import { useTranslations } from "../i18n/utils.js";
import { validateContactForm } from "../utils/contactValidation.js";

const ENDPOINT = "https://api.web3forms.com/submit";

/** @type {import("../utils/contactValidation.js").ContactField[]} */
const FIELD_ORDER = ["name", "email", "phone", "message", "consent"];

/**
 * Finds the service named in a `?service=<slug>` address.
 * @param {string} search - The query string, for example `?service=shiatsu`.
 * @param {string[]} slugs - The slugs of the services that exist.
 * @returns {string} The slug, or an empty string when it is missing or unknown.
 */
export function getServiceFromSearch(search, slugs) {
  const slug = new URLSearchParams(search).get("service") ?? "";
  return slugs.includes(slug) ? slug : "";
}

/**
 * @typedef {object} ContactFormProps
 * @property {"es" | "en"} lang - Language of the form.
 * @property {string} web3formsKey - Public Web3Forms access key. Empty when it is not configured.
 * @property {string} siteName - Business name, used in the email subject.
 * @property {{ slug: string, name: string }[]} services - Services to pick from.
 * @property {string} whatsappUrl - WhatsApp link shown when the form cannot be used.
 * @property {string} privacyHref - Address of the privacy notice.
 * @property {string} redirectUrl - Where Web3Forms sends people after a plain (no JavaScript) submit.
 */

/**
 * The contact form: inline translated errors, loading, success and error states,
 * and a plain form POST when JavaScript is not available.
 * @param {ContactFormProps} props - What the form needs.
 * @returns {import("react").JSX.Element} The form.
 */
export default function ContactForm({
  lang,
  web3formsKey,
  siteName,
  services,
  whatsappUrl,
  privacyHref,
  redirectUrl,
}) {
  const t = useTranslations(lang);
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    method: /** @type {"email" | "whatsapp" | "phone"} */ ("email"),
    service: "",
    consent: false,
  });
  const [errors, setErrors] = useState(
    /** @type {Partial<Record<import("../utils/contactValidation.js").ContactField, string>>} */ ({}),
  );
  const [status, setStatus] = useState(
    /** @type {"idle" | "submitting" | "success" | "error" | "unavailable"} */ (
      "idle"
    ),
  );
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    // Runs once after the page loads in the browser: the server cannot know the address query.
    /* eslint-disable react-hooks/set-state-in-effect */
    setEnhanced(true);
    const search = window.location.search;
    const service = getServiceFromSearch(
      search,
      services.map((s) => s.slug),
    );
    if (service) setValues((current) => ({ ...current, service }));
    if (new URLSearchParams(search).get("sent") === "1") setStatus("success");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [services]);

  /**
   * Updates one value and clears its error.
   * @param {string} field - The field name.
   * @param {string | boolean} value - The new value.
   */
  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[/** @type {keyof typeof next} */ (field)];
      return next;
    });
  };

  /**
   * Validates, then sends the form to Web3Forms without leaving the page.
   * @param {import("react").SyntheticEvent<HTMLFormElement>} event - The submit event.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = validateContactForm(values, lang);
    setErrors(result.errors);
    if (!result.valid) {
      setStatus("idle");
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    if (!web3formsKey) {
      setStatus("unavailable");
      return;
    }

    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const botcheck = /** @type {HTMLInputElement | null} */ (
      form.elements.namedItem("botcheck")
    );
    setStatus("submitting");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject: `${siteName}: ${values.name.trim()}`,
          from_name: siteName,
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          message: values.message.trim(),
          contact_method: values.method,
          service: values.service,
          botcheck: botcheck?.checked ?? false,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStatus("success");
        setValues((current) => ({
          ...current,
          name: "",
          email: "",
          phone: "",
          message: "",
          consent: false,
        }));
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  /**
   * Props that tie a field to its error message for screen readers.
   * @param {import("../utils/contactValidation.js").ContactField} field - The field name.
   * @returns {{ "aria-invalid": boolean, "aria-describedby"?: string }} The accessibility attributes.
   */
  const aria = (field) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  /**
   * Shows the error of a field, if it has one.
   * @param {import("../utils/contactValidation.js").ContactField} field - The field name.
   * @returns {import("react").JSX.Element | null} The message.
   */
  const error = (field) =>
    errors[field] ? (
      <p id={`${field}-error`} className="cf__error" role="alert">
        {errors[field]}
      </p>
    ) : null;

  const sending = status === "submitting";

  return (
    <form
      id="contact-form"
      className="cf"
      action={web3formsKey ? ENDPOINT : undefined}
      method="POST"
      noValidate={enhanced}
      onSubmit={handleSubmit}
    >
      {web3formsKey && (
        <>
          <input type="hidden" name="access_key" value={web3formsKey} />
          <input type="hidden" name="subject" value={siteName} />
          <input type="hidden" name="from_name" value={siteName} />
          <input type="hidden" name="redirect" value={redirectUrl} />
        </>
      )}
      <div className="cf__trap" aria-hidden="true">
        <input
          type="checkbox"
          name="botcheck"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="cf__field">
        <input
          type="text"
          id="name"
          name="name"
          placeholder=" "
          autoComplete="name"
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          {...aria("name")}
        />
        <label htmlFor="name">{t("contact.name")}</label>
        {error("name")}
      </div>

      <div className="cf__field">
        <input
          type="email"
          id="email"
          name="email"
          placeholder=" "
          autoComplete="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          {...aria("email")}
        />
        <label htmlFor="email">{t("contact.email")}</label>
        {error("email")}
      </div>

      <div className="cf__field">
        <input
          type="tel"
          id="phone"
          name="phone"
          placeholder=" "
          autoComplete="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          {...aria("phone")}
        />
        <label htmlFor="phone">{t("contact.phone")}</label>
        {error("phone")}
      </div>

      <div className="cf__field cf__field--select">
        <label htmlFor="service">{t("contact.service")}</label>
        <select
          id="service"
          name="service"
          value={values.service}
          onChange={(e) => update("service", e.target.value)}
        >
          <option value="">{t("contact.servicePlaceholder")}</option>
          {services.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.name}
            </option>
          ))}
        </select>
      </div>

      <div className="cf__field">
        <textarea
          id="message"
          name="message"
          placeholder=" "
          rows={4}
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          {...aria("message")}
        />
        <label htmlFor="message">{t("contact.message")}</label>
        {error("message")}
      </div>

      <div className="cf__field cf__field--select">
        <label htmlFor="contact-method">{t("contact.method")}</label>
        <select
          id="contact-method"
          name="contact_method"
          value={values.method}
          onChange={(e) => update("method", e.target.value)}
        >
          <option value="email">{t("contact.methodEmail")}</option>
          <option value="whatsapp">{t("contact.methodWhatsapp")}</option>
          <option value="phone">{t("contact.methodPhone")}</option>
        </select>
      </div>

      <div className="cf__consent-field">
        <div className="cf__consent">
          <input
            type="checkbox"
            id="consent"
            name="consent"
            required
            checked={values.consent}
            onChange={(e) => update("consent", e.target.checked)}
            {...aria("consent")}
          />
          <label htmlFor="consent">
            {t("contact.consentPrefix")}
            <a href={privacyHref}>{t("contact.privacyLink")}</a>
          </label>
        </div>
        {error("consent")}
      </div>

      <button type="submit" className="cf__submit" disabled={sending}>
        {sending ? t("contact.sending") : t("contact.submit")}
      </button>

      <div className="cf__status" role="status" aria-live="polite">
        {status === "success" && (
          <p className="cf__message cf__message--success">
            {t("contact.success")}
          </p>
        )}
        {status === "error" && (
          <p className="cf__message cf__message--error">
            {t("contact.failure")}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              {t("contact.whatsappCta")}
            </a>
          </p>
        )}
        {status === "unavailable" && (
          <p className="cf__message cf__message--error">
            {t("contact.unavailable")}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              {t("contact.whatsappCta")}
            </a>
          </p>
        )}
      </div>
    </form>
  );
}
