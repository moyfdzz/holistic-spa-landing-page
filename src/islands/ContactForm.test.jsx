import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContactForm, { getServiceFromSearch } from "./ContactForm.jsx";

const services = [
  { slug: "shiatsu", name: "Masaje Shiatsu", durations: [60, 90, 120] },
  { slug: "facial", name: "Facial", durations: [60] },
  { slug: "prenatal", name: "Masaje prenatal", durations: [60, 90, 120] },
];

/**
 * Renders the form with test values.
 * @param {Partial<import("./ContactForm.jsx").ContactFormProps>} [props] - Values to change.
 * @returns {import("@testing-library/react").RenderResult} The rendered form.
 */
function setup(props = {}) {
  return render(
    <ContactForm
      lang="es"
      web3formsKey="test-key"
      siteName="Masajes Relax Monterrey"
      services={services}
      whatsappUrl="https://wa.me/528180171904"
      privacyHref="/aviso-de-privacidad"
      {...props}
    />,
  );
}

/**
 * Types a value in the field with the given label.
 * @param {string | RegExp} label - The label text.
 * @param {string} value - The text to type.
 */
function type(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Fills every required field with valid values. */
function fillValid() {
  type("Nombre", "Ana García");
  type("Correo Electrónico", "ana@example.com");
  fireEvent.click(screen.getByLabelText(/He leído y acepto/));
}

describe("getServiceFromSearch", () => {
  it("returns a known service and ignores everything else", () => {
    const slugs = ["shiatsu", "prenatal"];
    expect(getServiceFromSearch("?service=shiatsu", slugs)).toBe("shiatsu");
    expect(getServiceFromSearch("?service=nope", slugs)).toBe("");
    expect(getServiceFromSearch("", slugs)).toBe("");
  });
});

describe("ContactForm", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/contact");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows inline errors for an empty form, without alert() or sending", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    const name = screen.getByLabelText("Nombre");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", "name-error");
    expect(screen.getByText("Por favor, ingresa tu nombre.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(
      screen.getByText(/Necesitas aceptar el Aviso de Privacidad/),
    ).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("clears an error when the person fixes the field", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    type("Nombre", "Ana");
    expect(screen.getByLabelText("Nombre")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("asks for a phone number when WhatsApp is the contact method", () => {
    setup();
    fillValid();
    fireEvent.change(screen.getByLabelText(/Cómo prefieres/), {
      target: { value: "whatsapp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(
      screen.getByText(/ingresa tu número de teléfono/),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the form, shows a confirmation and clears the fields", async () => {
    vi.mocked(fetch).mockResolvedValue(
      /** @type {Response} */ ({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    setup();
    fillValid();
    fireEvent.change(screen.getByLabelText(/Servicio de interés/), {
      target: { value: "prenatal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(document.querySelector("dialog")).toHaveAttribute("open"),
    );
    expect(
      screen.getByRole("heading", { name: "¡Mensaje enviado!" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Gracias/)).toBeInTheDocument();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.web3forms.com/submit");
    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({
      access_key: "test-key",
      name: "Ana García",
      email: "ana@example.com",
      service: "prenatal",
      contact_method: "email",
      botcheck: false,
    });
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
  });

  it("closes the confirmation with its button", async () => {
    vi.mocked(fetch).mockResolvedValue(
      /** @type {Response} */ ({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    setup();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(document.querySelector("dialog")).toHaveAttribute("open"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("shows a retry message with a WhatsApp link when sending fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      /** @type {Response} */ ({
        ok: false,
        json: async () => ({ success: false }),
      }),
    );
    setup();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/No pudimos enviar/),
    );
    expect(
      screen.getByRole("link", { name: "Escribir por WhatsApp" }),
    ).toHaveAttribute("href", "https://wa.me/528180171904");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana García");
  });

  it("shows the same retry message when the network fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    setup();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/No pudimos enviar/),
    );
  });

  it("says the form is unavailable when there is no access key", () => {
    setup({ web3formsKey: "" });
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByRole("status")).toHaveTextContent(/no está disponible/);
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('input[name="access_key"]')).toBeNull();
  });

  it("never posts the form by itself: sending goes through JavaScript only", () => {
    setup();
    const form = document.getElementById("contact-form");
    expect(form).not.toHaveAttribute("action");
    expect(document.querySelector('input[name="access_key"]')).toBeNull();
    expect(document.querySelector('input[name="redirect"]')).toBeNull();
    expect(
      document.querySelector('input[name="botcheck"]'),
    ).toBeInTheDocument();
  });

  it("preselects the service from the address", () => {
    window.history.replaceState({}, "", "/contact?service=shiatsu");
    setup();
    expect(screen.getByLabelText(/Servicio de interés/)).toHaveValue("shiatsu");
  });

  it("offers the lengths of the chosen service and nothing before that", () => {
    setup();
    expect(screen.queryByLabelText(/Duración de la sesión/)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Servicio de interés/), {
      target: { value: "shiatsu" },
    });
    const select = screen.getByLabelText(/Duración de la sesión/);
    expect(select).toHaveValue("");
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => o.value),
    ).toEqual(["", "60", "90", "120"]);

    fireEvent.change(select, { target: { value: "90" } });
    expect(select).toHaveValue("90");
  });

  it("picks the only length of a facial and clears a length that no longer exists", () => {
    setup();
    const service = screen.getByLabelText(/Servicio de interés/);
    fireEvent.change(service, { target: { value: "shiatsu" } });
    fireEvent.change(screen.getByLabelText(/Duración de la sesión/), {
      target: { value: "120" },
    });

    fireEvent.change(service, { target: { value: "facial" } });
    const select = screen.getByLabelText(/Duración de la sesión/);
    expect(select).toHaveValue("60");
    expect(select.querySelectorAll("option")).toHaveLength(2);
  });

  it("sends the chosen length with the message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      /** @type {Response} */ ({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    setup();
    fillValid();
    fireEvent.change(screen.getByLabelText(/Servicio de interés/), {
      target: { value: "shiatsu" },
    });
    fireEvent.change(screen.getByLabelText(/Duración de la sesión/), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      service: "shiatsu",
      duration: "90 min",
    });
  });

  it("speaks English on the English page", () => {
    setup({ lang: "en" });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Please enter your name.")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/I have read and accept the/),
    ).toBeInTheDocument();
  });
});
