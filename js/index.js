// JavaScript for sticky navbar
window.addEventListener("scroll", function () {
  const headerTag = this.document.querySelector("header");
  headerTag.classList.toggle("sticky", this.window.scrollY > 60);
});

// Navigation Sidebar Menu
const menu = document.querySelector(".nav__links");
const showMenu = document.querySelector(".show-menu");
const closeMenu = document.querySelector(".close-menu");

showMenu.addEventListener("click", () => {
  menu.classList.add("active");
});

closeMenu.addEventListener("click", () => {
  menu.classList.remove("active");
});

const navLinks = document.querySelectorAll(".nav__link");

function removeActiveClass() {
  navLinks.forEach((link) => {
    link.classList.remove("nav__link--active");
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    removeActiveClass();
    e.target.classList.add("nav__link--active");
  });
});

// Swiper
const swiper = new Swiper(".swiper", {
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

  // Navigation Arrows
  navigation: {
    nextEl: ".swiper__custom-nav--next",
    prevEl: ".swiper__custom-nav--prev",
  },
});

// FAQ Section
function toggleAccordion(accordionId) {
  const accordionItem = document.getElementById(accordionId);
  const answer = accordionItem.querySelector(".answer");
  const arrow = accordionItem.querySelector(".fa-arrow-up");

  const accordionLink = accordionItem.querySelector(".accordion__link");

  if (accordionItem.classList.contains("active")) {
    accordionItem.classList.remove("active");
    answer.style.maxHeight = "0";
    arrow.style.transform = "rotate(0deg)";
    accordionLink.setAttribute("aria-expanded", "false");
  } else {
    accordionItem.classList.add("active");
    answer.style.maxHeight = answer.scrollHeight + "px";
    arrow.style.transform = "rotate(180deg)";
    accordionLink.setAttribute("aria-expanded", "true");
  }
}

// Index Page Parallax
document.addEventListener("DOMContentLoaded", function () {
  let aboutImg = document.getElementsByClassName("about__img");
  let serviceImg = document.getElementsByClassName("service__img");

  new simpleParallax(aboutImg, {
    delay: 0.6,
    scale: 1.1,
    transition: "cubic-bezier(0,0,0,1)",
  });

  new simpleParallax(serviceImg, {
    delay: 0.6,
    scale: 1.1,
    orientation: "left",
    transition: "cubic-bezier(0,0,0,1)",
  });
});

// Scroll Animation
const sr = ScrollReveal({
  origin: "bottom",
  disntace: "60px",
  duration: 1000,
  delay: 100,
  easing: "ease-in-out",
});

// Hero Section
sr.reveal(".hero__slogan");
sr.reveal(".hero__title", { delay: 400 });
sr.reveal(".hero__description", { delay: 500 });
sr.reveal(".hero__button", { delay: 600 });

// About Section
sr.reveal(".about__imgs");
sr.reveal(".about__content", { delay: 400 });
sr.reveal(".about__years-of-experience", { delay: 500 });
sr.reveal(".about__services-diversity", { delay: 500 });

// Services Section
sr.reveal(".services");

// FAQ Section
sr.reveal(".FAQ__header");

// FAQ Questions Reveal
const delayIncrement = 100;
let totalQuestions = 5;

for (let i = 1; i <= totalQuestions; i++) {
  const selector = `#question${i}`;
  const delay = 400 + i * delayIncrement;

  sr.reveal(selector, { delay });
}

// Contact Page
sr.reveal(".contact__headline");
sr.reveal(".contact__content", { delay: 400 });

// Logic to ensure that the user must enter a phone number when selecting either "phone" or "whatsapp" as the contact method
document.addEventListener("DOMContentLoaded", function () {
  const contactMethod = document.getElementById("contact-method");
  const phoneInput = document.getElementById("phone");
  const form = document.getElementById("contact-form");

  // Disable default HTML5 validation
  form.setAttribute("novalidate", "true");

  // In case the contact method is WhatsApp or Phone, this validates the phone input is required.
  function validatePhoneRequirement() {
    if (contactMethod.value === "whatsapp" || contactMethod.value === "phone") {
      phoneInput.classList.add("required");
      phoneInput.dataset.required = "true";
    } else {
      phoneInput.classList.remove("required");
      phoneInput.dataset.required = "false";
      phoneInput.classList.remove("valid");
    }
  }

  // Run validation immediately in case an option is preselected
  validatePhoneRequirement();

  contactMethod.addEventListener("change", validatePhoneRequirement);

  phoneInput.addEventListener("input", function () {
    // Remove non-numeric characters
    phoneInput.value = phoneInput.value.replace(/\D/g, "");

    if (phoneInput.value.trim() !== "") {
      phoneInput.classList.add("valid");
    } else {
      phoneInput.classList.remove("valid");
    }
  });

  form.addEventListener("submit", function (event) {
    if (phoneInput.dataset.required === "true") {
      if (phoneInput.value.trim() === "") {
        event.preventDefault();
        alert(
          "Por favor, ingresa tu número de teléfono para WhatsApp o Llamada."
        );
        return;
      } else if (!/^\d+$/.test(phoneInput.value.trim())) {
        event.preventDefault();
        alert("El número de teléfono solo puede contener dígitos (0-9).");
        return;
      }
    }
  });
});
