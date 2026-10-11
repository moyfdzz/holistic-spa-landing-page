/**
 * WhatsApp link helper.
 * @module utils/whatsapp
 */

/**
 * Builds a link that opens a WhatsApp chat, with an optional ready-to-send message.
 * @param {string} phone - Phone number in international format. Spaces, dashes and the plus sign are ignored.
 * @param {string} [message] - Text to put in the message box. Leave empty to just open the chat.
 * @returns {string} A `https://wa.me/...` link.
 * @throws {TypeError} If the phone number does not have at least 8 digits.
 */
export function buildWhatsAppUrl(phone, message = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 8) {
    throw new TypeError("phone must be an international number with digits");
  }
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
