/**
 * Services shown on the site, with their texts in both languages.
 * The owner reviews the wording.
 * @module data/services
 */
import relaxing from "../assets/images/relaxing-massage.jpg";
import decontracting from "../assets/images/decontracting-massage.jpg";
import linfatic from "../assets/images/linfatic-massage.jpg";
import shiatsu from "../assets/images/shiatsu-massage.jpg";
import sport from "../assets/images/sport-massage.jpg";
import deepFacial from "../assets/images/deep-facial.jpg";
import moisturizingFacial from "../assets/images/moisturizing-facial.jpg";
import prenatal from "../assets/images/prenatal-massage.jpg";

/**
 * @typedef {object} ServiceText
 * @property {string} name - Service name.
 * @property {string} description - One or two lines about what is done.
 * @property {string[]} benefits - Short benefits.
 * @property {string} imageAlt - Description of the photo for screen readers.
 */

/**
 * @typedef {object} Service
 * @property {string} id - Stable id.
 * @property {string} slug - Used in `?service=<slug>` links to the contact form.
 * @property {string} icon - Icon name from the icon library, such as `lucide:droplets`.
 * @property {ImageMetadata} image - Photo for the card.
 * @property {number[]} durations - Session lengths in minutes the client can choose from, shortest first.
 * @property {{ es: ServiceText, en: ServiceText }} text - Texts per language.
 */

/** Every massage can be booked for 60, 90 or 120 minutes. */
const MASSAGE_DURATIONS = [60, 90, 120];

/** Every facial lasts 60 minutes. */
const FACIAL_DURATIONS = [60];

/** @type {Service[]} */
export const services = [
  {
    id: "relaxing",
    slug: "relajante",
    icon: "lucide:flower-2",
    image: relaxing,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje relajante",
        description:
          "Movimientos suaves y pausados para liberar el estrés y favorecer un descanso profundo.",
        benefits: ["Reduce el estrés", "Mejora el descanso"],
        imageAlt:
          "Mujer boca abajo con los ojos cerrados mientras recibe un masaje relajante en la espalda",
      },
      en: {
        name: "Relaxing massage",
        description:
          "Smooth, slow strokes to release stress and promote deep rest.",
        benefits: ["Reduces stress", "Improves rest"],
        imageAlt:
          "Woman lying face down with her eyes closed while receiving a relaxing back massage",
      },
    },
  },
  {
    id: "decontracting",
    slug: "descontracturante",
    icon: "lucide:hand",
    image: decontracting,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje descontracturante",
        description:
          "Presión firme sobre nudos y zonas tensas de espalda, cuello y hombros.",
        benefits: ["Alivia contracturas", "Libera tensión muscular"],
        imageAlt:
          "Manos de una terapeuta amasando el hombro de un hombre en un masaje descontracturante",
      },
      en: {
        name: "Deep-tissue massage",
        description:
          "Firm pressure on knots and tense areas of the back, neck and shoulders.",
        benefits: ["Relieves muscle knots", "Releases muscle tension"],
        imageAlt:
          "Therapist's hands kneading a man's shoulder in a deep-tissue massage",
      },
    },
  },
  {
    id: "lymphatic",
    slug: "linfatico",
    icon: "lucide:droplets",
    image: linfatic,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje linfático",
        description:
          "Movimientos suaves y rítmicos que estimulan la circulación linfática y reducen la retención de líquidos.",
        benefits: ["Reduce la hinchazón", "Estimula la circulación"],
        imageAlt:
          "Mujer envuelta en una toalla con las manos de la terapeuta suavemente sobre su frente y mandíbula",
      },
      en: {
        name: "Lymphatic drainage",
        description:
          "Gentle rhythmic movements that stimulate lymph flow and reduce fluid retention and swelling.",
        benefits: ["Reduces swelling", "Stimulates circulation"],
        imageAlt:
          "Woman wrapped in a towel with the therapist's hands resting gently on her forehead and jaw",
      },
    },
  },
  {
    id: "shiatsu",
    slug: "shiatsu",
    icon: "lucide:hand-heart",
    image: shiatsu,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje Shiatsu",
        description:
          "Técnica japonesa de presión con los dedos sobre puntos de energía para reequilibrar cuerpo y mente.",
        benefits: ["Equilibra cuerpo y mente", "Calma la tensión"],
        imageAlt:
          "Manos presionando con firmeza la espalda de una mujer durante un masaje Shiatsu",
      },
      en: {
        name: "Shiatsu",
        description:
          "Japanese finger-pressure technique on energy points to rebalance body and mind.",
        benefits: ["Balances body and mind", "Eases tension"],
        imageAlt:
          "Hands pressing firmly on a woman's back during a Shiatsu massage",
      },
    },
  },
  {
    id: "sport",
    slug: "deportivo",
    icon: "lucide:dumbbell",
    image: sport,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje deportivo",
        description:
          "Prepara o recupera los músculos antes o después de entrenar, mejora la flexibilidad y reduce las molestias.",
        benefits: ["Mejora la flexibilidad", "Acelera la recuperación"],
        imageAlt:
          "Terapeuta estirando y presionando la pierna de una persona durante un masaje deportivo",
      },
      en: {
        name: "Sports massage",
        description:
          "Prepares or recovers muscles before or after training, improving flexibility and reducing soreness.",
        benefits: ["Improves flexibility", "Speeds up recovery"],
        imageAlt:
          "Therapist stretching and pressing a person's leg during a sports massage",
      },
    },
  },
  {
    id: "deepFacial",
    slug: "facial-limpieza-profunda",
    icon: "lucide:sparkles",
    image: deepFacial,
    durations: FACIAL_DURATIONS,
    text: {
      es: {
        name: "Facial de limpieza profunda",
        description:
          "Limpieza, exfoliación, extracción y mascarilla para purificar los poros y renovar la piel.",
        benefits: ["Purifica los poros", "Renueva la piel"],
        imageAlt:
          "Mujer recibiendo un facial de limpieza profunda con producto en la mandíbula",
      },
      en: {
        name: "Deep-cleansing facial",
        description:
          "Cleansing, exfoliation, extraction and a mask to purify pores and renew the skin.",
        benefits: ["Purifies pores", "Renews the skin"],
        imageAlt:
          "Woman receiving a deep-cleansing facial with product on her jaw",
      },
    },
  },
  {
    id: "moisturizingFacial",
    slug: "facial-hidratante",
    icon: "lucide:droplet",
    image: moisturizingFacial,
    durations: FACIAL_DURATIONS,
    text: {
      es: {
        name: "Facial hidratante",
        description:
          "Productos nutritivos y un suave masaje facial que devuelven la hidratación y el brillo a la piel.",
        benefits: ["Hidrata en profundidad", "Da luminosidad"],
        imageAlt:
          "Esteticista con guantes rosas dando un masaje facial hidratante a una mujer con gorro",
      },
      en: {
        name: "Moisturizing facial",
        description:
          "Nourishing products and a gentle facial massage that restore hydration and glow.",
        benefits: ["Deeply hydrates", "Adds glow"],
        imageAlt:
          "Beautician in pink gloves giving a moisturizing facial massage to a woman wearing a hair cap",
      },
    },
  },
  {
    id: "prenatal",
    slug: "prenatal",
    icon: "lucide:baby",
    image: prenatal,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje prenatal",
        description:
          "Posiciones seguras y cómodas para aliviar las molestias de espalda, piernas y cadera durante el embarazo.",
        benefits: ["Alivia la espalda y la cadera", "Cómodo y seguro"],
        imageAlt:
          "Mujer embarazada recostada con los ojos cerrados mientras recibe un masaje prenatal en el hombro",
      },
      en: {
        name: "Prenatal massage",
        description:
          "Safe, comfortable positioning to relieve back, leg and hip discomfort during pregnancy.",
        benefits: ["Eases back and hip pain", "Comfortable and safe"],
        imageAlt:
          "Pregnant woman lying back with her eyes closed while receiving a prenatal shoulder massage",
      },
    },
  },
];

/**
 * Finds the session lengths of a service.
 * @param {string} slug - The service slug, for example `shiatsu`.
 * @returns {number[]} The lengths in minutes, or an empty list when the slug is unknown.
 */
export function getDurationsBySlug(slug) {
  return services.find((service) => service.slug === slug)?.durations ?? [];
}
