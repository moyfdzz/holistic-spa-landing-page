/**
 * Services shown on the site, with their texts in both languages.
 * The owner reviews the wording.
 * @module data/services
 */
import relaxing from "../assets/images/ai/relaxing.webp";
import decontracting from "../assets/images/ai/decontracting.webp";
import lymphatic from "../assets/images/ai/lymphatic.webp";
import shiatsu from "../assets/images/ai/shiatsu.webp";
import sport from "../assets/images/ai/sport.webp";
import deepFacial from "../assets/images/ai/deep-facial.webp";
import moisturizingFacial from "../assets/images/ai/moisturizing-facial.webp";
import prenatal from "../assets/images/ai/prenatal.webp";
import craniofacial from "../assets/images/ai/craniofacial.webp";
import reflexology from "../assets/images/ai/reflexology.webp";

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

/** The short services (craniofacial massage and reflexology) take 15 or 30 minutes. */
const SHORT_DURATIONS = [15, 30];

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
          "Terapeuta dando un masaje relajante en la espalda a una persona acostada boca abajo, en una habitación luminosa con plantas",
      },
      en: {
        name: "Relaxing massage",
        description:
          "Smooth, slow strokes to release stress and promote deep rest.",
        benefits: ["Reduces stress", "Improves rest"],
        imageAlt:
          "Therapist giving a relaxing back massage to a person lying face down in a bright room with plants",
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
          "Terapeuta presionando con firmeza la espalda alta de una persona boca abajo para aliviar una contractura",
      },
      en: {
        name: "Deep-tissue massage",
        description:
          "Firm pressure on knots and tense areas of the back, neck and shoulders.",
        benefits: ["Relieves muscle knots", "Releases muscle tension"],
        imageAlt:
          "Therapist pressing firmly on the upper back of a person lying face down to release a muscle knot",
      },
    },
  },
  {
    id: "lymphatic",
    slug: "linfatico",
    icon: "lucide:droplets",
    image: lymphatic,
    durations: MASSAGE_DURATIONS,
    text: {
      es: {
        name: "Masaje linfático",
        description:
          "Movimientos suaves y rítmicos que estimulan la circulación linfática y reducen la retención de líquidos.",
        benefits: ["Reduce la hinchazón", "Estimula la circulación"],
        imageAlt:
          "Terapeuta realizando un drenaje linfático con movimientos suaves en la pierna de una persona acostada boca arriba",
      },
      en: {
        name: "Lymphatic drainage",
        description:
          "Gentle rhythmic movements that stimulate lymph flow and reduce fluid retention and swelling.",
        benefits: ["Reduces swelling", "Stimulates circulation"],
        imageAlt:
          "Therapist doing gentle lymphatic drainage strokes on the leg of a person lying on their back",
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
          "Terapeuta aplicando presión con los dedos en la espalda de una persona acostada sobre un colchón en el suelo, en un masaje shiatsu",
      },
      en: {
        name: "Shiatsu",
        description:
          "Japanese finger-pressure technique on energy points to rebalance body and mind.",
        benefits: ["Balances body and mind", "Eases tension"],
        imageAlt:
          "Therapist using finger pressure on the back of a person lying on a floor mat during a shiatsu massage",
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
          "Terapeuta masajeando la pierna musculosa de un deportista acostado boca abajo y cubierto con una toalla",
      },
      en: {
        name: "Sports massage",
        description:
          "Prepares or recovers muscles before or after training, improving flexibility and reducing soreness.",
        benefits: ["Improves flexibility", "Speeds up recovery"],
        imageAlt:
          "Therapist massaging the muscular leg of an athlete lying face down and covered with a towel",
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
          "Mujer con una mascarilla de arcilla verde recibiendo un facial de limpieza profunda mientras la terapeuta masajea su rostro",
      },
      en: {
        name: "Deep-cleansing facial",
        description:
          "Cleansing, exfoliation, extraction and a mask to purify pores and renew the skin.",
        benefits: ["Purifies pores", "Renews the skin"],
        imageAlt:
          "Woman with a green clay mask receiving a deep-cleansing facial while the therapist massages her face",
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
          "Terapeuta dando un masaje facial hidratante a una persona con diadema, de piel luminosa y ojos cerrados",
      },
      en: {
        name: "Moisturizing facial",
        description:
          "Nourishing products and a gentle facial massage that restore hydration and glow.",
        benefits: ["Deeply hydrates", "Adds glow"],
        imageAlt:
          "Therapist giving a moisturizing facial massage to a person wearing a headband, with glowing skin and closed eyes",
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
          "Mujer embarazada recostada con almohadas mientras una terapeuta le da un masaje suave y seguro",
      },
      en: {
        name: "Prenatal massage",
        description:
          "Safe, comfortable positioning to relieve back, leg and hip discomfort during pregnancy.",
        benefits: ["Eases back and hip pain", "Comfortable and safe"],
        imageAlt:
          "Pregnant woman reclining with pillows while a therapist gives her a gentle, safe massage",
      },
    },
  },
  {
    id: "craniofacial",
    slug: "craneofacial",
    icon: "lucide:smile",
    image: craniofacial,
    durations: SHORT_DURATIONS,
    text: {
      es: {
        name: "Masaje craneofacial",
        description:
          "Maniobras suaves en cuero cabelludo, frente, sienes, mandíbula y cuello para soltar la tensión y el cansancio del rostro.",
        benefits: ["Alivia la tensión", "Relaja la mandíbula"],
        imageAlt:
          "Terapeuta sentada junto a la cabecera de una persona recostada, dándole un masaje craneofacial con las manos sobre su frente y sus sienes",
      },
      en: {
        name: "Craniofacial massage",
        description:
          "Gentle techniques on the scalp, forehead, temples, jaw and neck to release tension and facial fatigue.",
        benefits: ["Eases tension", "Relaxes the jaw"],
        imageAlt:
          "Therapist seated at the head of a reclining person, giving a craniofacial massage with her hands on their forehead and temples",
      },
    },
  },
  {
    id: "reflexology",
    slug: "reflexologia",
    icon: "lucide:footprints",
    image: reflexology,
    durations: SHORT_DURATIONS,
    text: {
      es: {
        name: "Reflexología de pies y manos",
        description:
          "Presión suave sobre puntos específicos de pies y manos para promover la relajación y el bienestar general.",
        benefits: ["Promueve la relajación", "Alivia el cansancio"],
        imageAlt:
          "Terapeuta sentada al pie de la camilla masajeando con ambas manos la planta del pie de una persona recostada, en una sesión de reflexología",
      },
      en: {
        name: "Foot and hand reflexology",
        description:
          "Gentle pressure on specific points of the feet and hands to promote relaxation and overall well-being.",
        benefits: ["Promotes relaxation", "Eases tiredness"],
        imageAlt:
          "Therapist seated at the foot of the massage table massaging the sole of a reclining person's foot with both hands during a reflexology session",
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
