/**
 * Services shown on the site.
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
 * @typedef {object} Service
 * @property {string} name - Service name shown on its card.
 * @property {ImageMetadata} image - Photo for the card (decorative).
 */

// REL-18 rebuilds this list with descriptions, durations and translations.
/** @type {Service[]} */
export const services = [
  { name: "Masaje relajante", image: relaxing },
  { name: "Masaje descontracturante", image: decontracting },
  { name: "Masaje linfático", image: linfatic },
  { name: "Masaje Shiatsu", image: shiatsu },
  { name: "Masaje deportivo", image: sport },
  { name: "Facial de limpieza profunda", image: deepFacial },
  { name: "Facial hidratante", image: moisturizingFacial },
  { name: "Masaje prenatal", image: prenatal },
];
