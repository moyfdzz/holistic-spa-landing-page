/**
 * Text of the privacy notice (Aviso de Privacidad), in both languages.
 * The Spanish version prevails. The owner should have it reviewed, ideally by a legal advisor.
 * @module data/privacy
 */
import { site } from "../config/site.js";

/** Date of the last change, as `YYYY-MM-DD`. Update it whenever the text changes. */
export const privacyUpdated = "2026-10-11";

/**
 * @typedef {object} PrivacySection
 * @property {string} id - Anchor id of the section.
 * @property {string} heading - Section title.
 * @property {string[]} paragraphs - Paragraphs of text.
 * @property {string[]} [items] - Optional bullet list shown after the paragraphs.
 */

/**
 * @typedef {object} PrivacyText
 * @property {string} title - Page title.
 * @property {string} intro - Opening paragraph.
 * @property {PrivacySection[]} sections - The sections of the notice.
 */

/** @type {{ es: PrivacyText, en: PrivacyText }} */
export const privacy = {
  es: {
    title: "Aviso de Privacidad",
    intro: `${site.name} (en adelante, "el Responsable") respeta tu privacidad y protege tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Este aviso explica qué datos recabamos, para qué los usamos y cómo puedes ejercer tus derechos.`,
    sections: [
      {
        id: "responsable",
        heading: "1. Responsable del tratamiento",
        paragraphs: [
          `El responsable de tus datos personales es ${site.name}, un servicio de masajes y faciales a domicilio en ${site.area}.`,
          `Para cualquier asunto de privacidad puedes escribirnos por WhatsApp o llamarnos al ${site.phone}, o usar el formulario de contacto de este sitio.`,
        ],
      },
      {
        id: "datos",
        heading: "2. Datos personales que recabamos",
        paragraphs: [
          "Cuando nos contactas por el formulario del sitio, por WhatsApp o por teléfono, podemos recabar:",
        ],
        items: [
          "Nombre.",
          "Correo electrónico y/o número de teléfono, según el medio de contacto que prefieras.",
          "Servicio de interés y el mensaje que decidas escribirnos.",
          "Medio de contacto preferido.",
        ],
      },
      {
        id: "sensibles",
        heading: "3. Datos sensibles",
        paragraphs: [
          "No solicitamos datos personales sensibles en el formulario. Si decides compartirnos información de salud relevante para tu masaje (por ejemplo, un embarazo o una lesión), la trataremos con confidencialidad y solo para ofrecerte el servicio de forma segura. Al compartirla, nos das tu consentimiento expreso para ese fin.",
        ],
      },
      {
        id: "finalidades",
        heading: "4. Para qué usamos tus datos",
        paragraphs: [
          "Usamos tus datos únicamente para las siguientes finalidades:",
        ],
        items: [
          "Responder tus preguntas y solicitudes de información.",
          "Cotizar y agendar tu servicio a domicilio.",
          "Dar seguimiento a tu cita y a tu servicio.",
        ],
      },
      {
        id: "terceros",
        heading: "5. Con quién se procesan tus datos",
        paragraphs: [
          "No vendemos tus datos ni los compartimos con terceros para sus propios fines. Para operar este sitio utilizamos proveedores que procesan información por nuestra cuenta:",
        ],
        items: [
          "Web3Forms: recibe y nos entrega los mensajes enviados por el formulario de contacto.",
          "Cloudflare: aloja este sitio web y gestiona su dominio.",
          "WhatsApp (Meta): si nos escribes por WhatsApp, la conversación se rige también por el aviso de privacidad de esa plataforma.",
        ],
      },
      {
        id: "arco",
        heading: "6. Tus derechos (ARCO) y cómo revocar tu consentimiento",
        paragraphs: [
          "Tienes derecho a acceder a tus datos, rectificarlos si son inexactos, cancelarlos u oponerte a su uso (derechos ARCO), así como a revocar tu consentimiento en cualquier momento.",
          `Para ejercerlos, envíanos tu solicitud por WhatsApp o por el formulario de contacto, o llámanos al ${site.phone}, indicando tu nombre, un medio para responderte y qué derecho quieres ejercer. Te responderemos en los plazos que establece la ley.`,
        ],
      },
      {
        id: "cookies",
        heading: "7. Cookies y tecnologías de rastreo",
        paragraphs: [
          "Este sitio no usa cookies de publicidad ni herramientas de analítica. Solo guarda en tu navegador tu preferencia de idioma, para recordar si prefieres español o inglés. Si en el futuro agregamos analítica o cookies, actualizaremos este aviso y te pediremos tu consentimiento cuando sea necesario.",
        ],
      },
      {
        id: "cambios",
        heading: "8. Cambios a este aviso",
        paragraphs: [
          "Si este aviso cambia, publicaremos la versión actualizada en esta misma página y modificaremos la fecha de última actualización.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Notice",
    intro: `${site.name} ("the Controller") respects your privacy and protects your personal data in line with the Mexican Federal Law on Protection of Personal Data Held by Private Parties. This notice explains what data we collect, what we use it for and how you can exercise your rights. This English version is for information only; the Spanish version (Aviso de Privacidad) prevails.`,
    sections: [
      {
        id: "responsable",
        heading: "1. Who is responsible",
        paragraphs: [
          `The controller of your personal data is ${site.name}, an at-home massage and facial service in ${site.area}.`,
          `For any privacy matter you can message us on WhatsApp or call ${site.phone}, or use the contact form on this site.`,
        ],
      },
      {
        id: "datos",
        heading: "2. Personal data we collect",
        paragraphs: [
          "When you contact us through the website form, on WhatsApp or by phone, we may collect:",
        ],
        items: [
          "Your name.",
          "Your email and/or phone number, depending on how you prefer to be contacted.",
          "The service you are interested in and the message you choose to write to us.",
          "Your preferred way to be contacted.",
        ],
      },
      {
        id: "sensibles",
        heading: "3. Sensitive data",
        paragraphs: [
          "We do not ask for sensitive personal data in the form. If you choose to share health information that matters for your massage (for example, a pregnancy or an injury), we will treat it confidentially and only to offer you the service safely. By sharing it, you give your express consent for that purpose.",
        ],
      },
      {
        id: "finalidades",
        heading: "4. What we use your data for",
        paragraphs: ["We use your data only for these purposes:"],
        items: [
          "To answer your questions and requests for information.",
          "To quote and schedule your at-home service.",
          "To follow up on your appointment and service.",
        ],
      },
      {
        id: "terceros",
        heading: "5. Who processes your data",
        paragraphs: [
          "We do not sell your data or share it with third parties for their own purposes. To run this site we use providers that process information on our behalf:",
        ],
        items: [
          "Web3Forms: receives and delivers to us the messages sent through the contact form.",
          "Cloudflare: hosts this website and manages its domain.",
          "WhatsApp (Meta): if you message us on WhatsApp, the conversation is also governed by that platform's privacy notice.",
        ],
      },
      {
        id: "arco",
        heading: "6. Your rights (ARCO) and how to withdraw consent",
        paragraphs: [
          "You have the right to access your data, correct it if it is inaccurate, delete it or object to its use (ARCO rights), and to withdraw your consent at any time.",
          `To exercise them, send us your request on WhatsApp or through the contact form, or call ${site.phone}, stating your name, a way to reply to you and which right you want to exercise. We will answer within the time limits set by law.`,
        ],
      },
      {
        id: "cookies",
        heading: "7. Cookies and tracking",
        paragraphs: [
          "This site does not use advertising cookies or analytics tools. It only stores your language preference in your browser, to remember whether you prefer Spanish or English. If we add analytics or cookies in the future, we will update this notice and ask for your consent when needed.",
        ],
      },
      {
        id: "cambios",
        heading: "8. Changes to this notice",
        paragraphs: [
          "If this notice changes, we will publish the updated version on this page and change the date of the last update.",
        ],
      },
    ],
  },
};
