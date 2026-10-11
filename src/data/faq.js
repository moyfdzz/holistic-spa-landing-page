/**
 * Frequently asked questions, in both languages. The owner reviews the answers.
 * @module data/faq
 */

/**
 * @typedef {object} FaqText
 * @property {string} question - The question.
 * @property {string} answer - The answer, in plain text.
 */

/**
 * @typedef {object} FaqItem
 * @property {string} id - Stable id, used in the page anchor.
 * @property {{ es: FaqText, en: FaqText }} text - The question and answer per language.
 */

/** @type {FaqItem[]} */
export const faq = [
  {
    id: "types",
    text: {
      es: {
        question: "¿Qué tipos de masajes ofrecen en la comodidad de mi hogar?",
        answer:
          "Ofrecemos una variedad de masajes, incluyendo masaje relajante, terapéutico, deportivo y para aliviar el estrés, todos realizados en la comodidad de tu hogar según tus necesidades.",
      },
      en: {
        question:
          "What types of massage do you offer in the comfort of my home?",
        answer:
          "We offer a variety of massages, including relaxing, therapeutic, sports and stress-relief massage, all done in the comfort of your home according to your needs.",
      },
    },
  },
  {
    id: "booking",
    text: {
      es: {
        question: "¿Cómo puedo reservar una cita para un masaje a domicilio?",
        answer:
          "Puedes reservar tu cita fácilmente llamándonos, enviándonos un mensaje a través de nuestra página web o por WhatsApp, o por cualquiera de nuestras redes sociales en la parte de abajo. Estamos disponibles para programar tu masaje según tu horario preferido.",
      },
      en: {
        question: "How can I book an at-home massage?",
        answer:
          "You can easily book by calling us, sending us a message through our website or on WhatsApp, or through any of our social networks below. We are available to schedule your massage at the time that suits you best.",
      },
    },
  },
  {
    id: "preparation",
    text: {
      es: {
        question:
          "¿Necesito tener alguna preparación especial antes de recibir el masaje en casa?",
        answer:
          "No necesitas prepararte de manera especial, pero te recomendamos estar en un ambiente cómodo y relajado. Nosotros llevaremos todo lo necesario para el masaje, solo asegúrate de contar con un espacio tranquilo.",
      },
      en: {
        question:
          "Do I need any special preparation before getting a massage at home?",
        answer:
          "You don't need to prepare in any special way, but we recommend being in a comfortable, relaxed setting. We bring everything needed for the massage; just make sure you have a quiet space.",
      },
    },
  },
  {
    id: "duration",
    text: {
      es: {
        question: "¿Cuánto dura una sesión?",
        answer:
          "Depende del servicio: la mayoría de las sesiones dura 60 minutos, el masaje deportivo entre 45 y 60 minutos y el facial hidratante 45 minutos. Puedes ver la duración de cada uno en la sección de servicios.",
      },
      en: {
        question: "How long does a session last?",
        answer:
          "It depends on the service: most sessions last 60 minutes, the sports massage 45 to 60 minutes and the moisturizing facial 45 minutes. You can see the length of each one in the services section.",
      },
    },
  },
  {
    id: "area",
    text: {
      es: {
        question: "¿Qué tan lejos viajan para brindar el servicio a domicilio?",
        answer:
          "Ofrecemos nuestros servicios en toda el área metropolitana de Monterrey. Si no estás seguro de si cubrimos tu área, contáctanos y te confirmaremos con gusto.",
      },
      en: {
        question: "How far do you travel to provide the at-home service?",
        answer:
          "We offer our services throughout the Monterrey metropolitan area. If you are not sure whether we cover your area, contact us and we will gladly confirm.",
      },
    },
  },
  {
    id: "safety",
    text: {
      es: {
        question: "¿Es seguro recibir un masaje en casa?",
        answer:
          "Sí, contamos con capacitación y se siguen estrictas normas de higiene y profesionalismo. Nos aseguramos de que cada servicio sea seguro, relajante y beneficioso para tu bienestar.",
      },
      en: {
        question: "Is it safe to get a massage at home?",
        answer:
          "Yes. We are trained and follow strict standards of hygiene and professionalism. We make sure every service is safe, relaxing and good for your well-being.",
      },
    },
  },
];
