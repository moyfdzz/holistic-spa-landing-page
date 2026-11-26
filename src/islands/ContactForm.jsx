import { useCallback, useEffect, useRef, useState } from "react";
import "./ContactForm.css";
import { useTranslations } from "../i18n/utils.js";
import { validateContactForm } from "../utils/contactValidation.js";
import { track } from "../utils/track.js";
import SuccessDialog from "./SuccessDialog.jsx";

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
 * Picks the session length to show after the service changes: the lengths depend on the
 * service, so the choice stays only if it still exists, and a single option is picked
 * (facials).
 * @param {number[]} options - Lengths the service offers.
 * @param {string} chosen - The length chosen before.
 * @returns {string} The length, or an empty string when the visitor has to choose.
 */
function keepDuration(options, chosen) {
  if (options.length === 1) return String(options[0]);
  return options.map(String).includes(chosen) ? chosen : "";
}

/**
 * Reads what the visitor typed or chose before React took over: until then the fields are
 * plain HTML, and the next render would write the empty state over them.
 * @param {HTMLFormElement} form - The form, not rendered again yet.
 * @returns {{ name: string, email: string, phone: string, message: string, method: "email" | "whatsapp" | "phone", service: string, consent: boolean }} The values on the page.
 */
function readEarlyValues(form) {
  const data = new FormData(form);
  /**
   * Reads one text field.
   * @param {string} name - Name of the field.
   * @returns {string} Its text.
   */
  const text = (name) => String(data.get(name) ?? "");
  return {
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    message: text("message"),
    method: /** @type {"email" | "whatsapp" | "phone"} */ (
      text("contact_method")
    ),
    service: text("service"),
    consent: data.has("consent"),
  };
}

/**
 * @typedef {object} ContactFormProps
 * @property {"es" | "en"} lang - Language of the form.
 * @property {string} web3formsKey - Public Web3Forms access key. Empty when it is not configured.
 * @property {string} siteName - Business name, used in the email subject.
 * @property {{ slug: string, name: string, durations: number[] }[]} services - Services to pick from, with the session lengths each one offers.
 * @property {string} whatsappUrl - WhatsApp link shown when the form cannot be used.
 * @property {string} privacyHref - Address of the privacy notice.
 */

/**
 * The contact form: inline translated errors, loading, error states and a
 * confirmation dialog in the visitor's language. Sending only happens through
 * JavaScript, so the visitor never leaves the site for a Web3Forms page.
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
}) {
  const t = useTranslations(lang);
  const formRef = useRef(/** @type {HTMLFormElement | null} */ (null));
  const started = useRef(false);
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    method: /** @type {"email" | "whatsapp" | "phone"} */ ("email"),
    service: "",
    duration: "",
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

  /** Reports once that the visitor started to fill the form. */
  const reportStart = useCallback(() => {
    if (started.current) return;
    started.current = true;
    track("form_start");
  }, []);

  useEffect(() => {
    // Runs once after the page loads in the browser: only there are the address query and
    // what the visitor already did with the form.
    const form = /** @type {HTMLFormElement} */ (formRef.current);
    const early = readEarlyValues(form);
    const touched = Boolean(
      early.name ||
      early.email ||
      early.phone ||
      early.message ||
      early.service ||
      early.consent ||
      early.method !== "email",
    );
    // The focus event of a field focused before this moment never reached React.
    if (touched || form.contains(document.activeElement)) reportStart();

    const service =
      early.service ||
      getServiceFromSearch(
        window.location.search,
        services.map((s) => s.slug),
      );
    const options = services.find((s) => s.slug === service)?.durations ?? [];
    /* eslint-disable react-hooks/set-state-in-effect */
    setEnhanced(true);
    setValues((current) => ({
      ...current,
      ...early,
      service,
      duration: keepDuration(options, current.duration),
    }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [services, reportStart]);

  /**
   * Updates one value and clears its error.
   * @param {string} field - The field name.
   * @param {string | boolean} value - The new value.
   */
  const update = (field, value) => {
    setValues((current) => {
      const next = { ...current, [field]: value };
      if (field === "service") {
        const options =
          services.find((service) => service.slug === value)?.durations ?? [];
        next.duration = keepDuration(options, current.duration);
      }
      return next;
    });
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
      track("form_error", { type: "validation" });
      setStatus("idle");
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    if (!web3formsKey) {
      track("form_error", { type: "unavailable" });
      setStatus("unavailable");
      return;
    }

    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const botcheck = /** @type {HTMLInputElement | null} */ (
      form.elements.namedItem("botcheck")
    );
    setStatus("submitting");
    track("form_submit");
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
          duration: values.duration ? `${values.duration} min` : "",
          botcheck: botcheck?.checked ?? false,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        track("form_success");
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
        track("form_error", { type: "service" });
        setStatus("error");
      }
    } catch {
      track("form_error", { type: "network" });
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

  const durationOptions =
    services.find((service) => service.slug === values.service)?.durations ??
    [];
  const sending = status === "submitting";

  return (
    <form
      ref={formRef}
      id="contact-form"
      className="cf"
      noValidate={enhanced}
      onSubmit={handleSubmit}
      onFocus={reportStart}
    >
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

      {durationOptions.length > 0 && (
        <div className="cf__field cf__field--select">
          <label htmlFor="duration">{t("contact.duration")}</label>
          <select
            id="duration"
            name="duration"
            value={values.duration}
            onChange={(e) => update("duration", e.target.value)}
          >
            <option value="">{t("contact.durationPlaceholder")}</option>
            {durationOptions.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {t("contact.durationOption", { time: minutes })}
              </option>
            ))}
          </select>
        </div>
      )}

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

      <button
        type="submit"
        className="cf__submit"
        disabled={sending || !enhanced}
      >
        {sending ? t("contact.sending") : t("contact.submit")}
      </button>

      <noscript>
        <p className="cf__message cf__message--error">
          {t("contact.noscript")}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            {t("contact.whatsappCta")}
          </a>
        </p>
      </noscript>

      <SuccessDialog
        open={status === "success"}
        title={t("contact.successTitle")}
        message={t("contact.success")}
        closeLabel={t("contact.close")}
        onClose={() => setStatus("idle")}
      />

      <div className="cf__status" role="status" aria-live="polite">
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
