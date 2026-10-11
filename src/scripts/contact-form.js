// @ts-nocheck
// Legacy contact form validation from the original site (it uses alert()).
// The form is rebuilt with inline, translated errors in REL-19, which replaces
// this file.

// Logic to ensure that the user must enter a phone number when selecting either "phone" or "whatsapp" as the contact method
document.addEventListener("DOMContentLoaded", function () {
  const contactMethod = document.getElementById("contact-method");
  const phoneInput = document.getElementById("phone");
  const emailInput = document.getElementById("email");
  const form = document.getElementById("contact-form");
  if (!form) return;

  // Disable default HTML5 validation
  form.setAttribute("novalidate", "true");

  // In case the contact method is WhatsApp or Phone, this validates the phone input is required.
  function validatePhoneRequirement() {
    if (contactMethod.value === "whatsapp" || contactMethod.value === "phone") {
      phoneInput.dataset.required = "true";
    } else {
      phoneInput.dataset.required = "false";
      phoneInput.classList.remove("error");
    }
  }

  function validateEmailRequirement() {
    if (contactMethod.value === "email") {
      emailInput.dataset.required = "true";
    } else {
      emailInput.dataset.required = "false";
      emailInput.classList.remove("error");
    }
  }

  // Run validation on page load
  validatePhoneRequirement();
  validateEmailRequirement();

  // Listen for changes in contact method
  contactMethod.addEventListener("change", function () {
    validatePhoneRequirement();
    validateEmailRequirement();
  });

  phoneInput.addEventListener("input", function () {
    // Remove non-numeric characters
    phoneInput.value = phoneInput.value.replace(/\D/g, "");

    // Remove error styling when user starts typing phone
    phoneInput.classList.remove("error");
  });

  emailInput.addEventListener("input", function () {
    // Remove error styling when user starts typing email
    emailInput.classList.remove("error");
  });

  form.addEventListener("submit", function (event) {
    let errors = [];

    // If contact method is WhatsApp or call, and the phone input is empty
    if (
      phoneInput.dataset.required === "true" &&
      phoneInput.value.trim() === ""
    ) {
      errors.push(form.dataset.errorPhoneRequired);
      phoneInput.classList.add("error");
    } else if (
      // If contact method is WhatsApp or call, the phone input is not empty, but it's not only digits between 0 and 9
      phoneInput.dataset.required === "true" &&
      !/^\d+$/.test(phoneInput.value.trim())
    ) {
      errors.push(form.dataset.errorPhoneDigits);
      phoneInput.classList.add("error");
    } else {
      phoneInput.classList.remove("error");
    }

    // If contact method is email, and the email input is empty
    if (
      emailInput.dataset.required === "true" &&
      emailInput.value.trim() === ""
    ) {
      errors.push(form.dataset.errorEmailRequired);
      emailInput.classList.add("error");
    } else {
      emailInput.classList.remove("error");
    }

    if (errors.length > 0) {
      event.preventDefault();
      alert(errors.join("\n"));
    }
  });
});
