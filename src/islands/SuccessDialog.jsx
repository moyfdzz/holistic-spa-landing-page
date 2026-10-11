import { useEffect, useRef } from "react";
import "./SuccessDialog.css";

/**
 * @typedef {object} SuccessDialogProps
 * @property {boolean} open - Whether the dialog is shown.
 * @property {string} title - Heading, already translated.
 * @property {string} message - Body text, already translated.
 * @property {string} closeLabel - Text of the close button, already translated.
 * @property {() => void} onClose - Called when the visitor closes the dialog.
 */

/**
 * A confirmation dialog built on the native `<dialog>` element, which traps the
 * focus, closes with Escape and gives the focus back to the form when it closes.
 * On phones it slides up from the bottom; on larger screens it is a centred card.
 * @param {SuccessDialogProps} props - What to show and how to close it.
 * @returns {import("react").JSX.Element} The dialog.
 */
export default function SuccessDialog({
  open,
  title,
  message,
  closeLabel,
  onClose,
}) {
  const ref = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  /** Closes the dialog; browsers without `close()` get the attribute removed. */
  const close = () => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      onClose();
    }
  };

  return (
    // The backdrop click is a mouse shortcut only: Escape and the button close it too.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={ref}
      className="sd"
      aria-labelledby="sd-title"
      aria-describedby="sd-message"
      onClose={onClose}
      onClick={(event) => {
        // A click on the dark backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sd__body">
        <span className="sd__icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 id="sd-title" className="sd__title">
          {title}
        </h2>
        <p id="sd-message" className="sd__message">
          {message}
        </p>
        <button type="button" className="sd__close" onClick={close}>
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
}
