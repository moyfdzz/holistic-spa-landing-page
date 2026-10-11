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
 * @property {string} id - Key of the service name in `src/i18n/*.json` (`services.items.<id>`).
 * @property {ImageMetadata} image - Photo for the card (decorative).
 */

// REL-18 rebuilds this list with descriptions and durations.
/** @type {Service[]} */
export const services = [
  { id: "relaxing", image: relaxing },
  { id: "decontracting", image: decontracting },
  { id: "lymphatic", image: linfatic },
  { id: "shiatsu", image: shiatsu },
  { id: "sport", image: sport },
  { id: "deepFacial", image: deepFacial },
  { id: "moisturizingFacial", image: moisturizingFacial },
  { id: "prenatal", image: prenatal },
];
