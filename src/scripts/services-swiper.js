// @ts-nocheck
// Legacy carousel code from the original site. The services section is rebuilt
// (without Swiper) in REL-18, which deletes this file.
import Swiper from "swiper/bundle";

new Swiper(".swiper", {
  slidesPerView: 3,
  direction: "horizontal",
  lazyLoading: true,
  spaceBetween: 7,
  grabCursor: false,
  centeredSlides: true,
  loop: true,
  keyboard: {
    enabled: true,
  },

  // Responsive Breakpoints
  breakpoints: {
    320: {
      slidesPerView: 1,
      spaceBetween: 30,
    },
    768: {
      slidesPerView: 1.5,
      spaceBetween: 10,
    },
    1024: {
      slidesPerView: 3,
      spaceBetween: 10,
    },
    1440: {
      slidesPerView: 3,
      spaceBetween: 10,
    },
  },

  // Screen reader texts in Spanish (Swiper's defaults are in English).
  a11y: {
    containerMessage: "Carrusel de servicios",
    containerRoleDescriptionMessage: "carrusel",
    itemRoleDescriptionMessage: "servicio",
    prevSlideMessage: "Servicio anterior",
    nextSlideMessage: "Servicio siguiente",
    firstSlideMessage: "Este es el primer servicio",
    lastSlideMessage: "Este es el último servicio",
    slideLabelMessage: "Servicio {{index}} de {{slidesLength}}",
  },

  // Navigation Arrows
  navigation: {
    nextEl: ".swiper__custom-nav--next",
    prevEl: ".swiper__custom-nav--prev",
  },
});
