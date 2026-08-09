import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableInside(node) {
  if (!node) return [];
  return [...node.querySelectorAll(FOCUSABLE)].filter(
    (element) => element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement,
  );
}

/**
 * Dialog behaviour every modal is expected to have: Escape closes it, Tab stays inside it,
 * the page behind stops scrolling, and focus returns to whatever opened it.
 *
 * @param {object} input
 * @param {boolean} input.open
 * @param {() => void} input.onClose
 * @param {{current: HTMLElement|null}} input.containerRef Element that holds the dialog content.
 */
export function useModalDismiss({ open, onClose, containerRef }) {
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const node = containerRef?.current;
      const first = focusableInside(node)[0];
      if (first) first.focus();
      else if (node) {
        node.setAttribute("tabindex", "-1");
        node.focus();
      }
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const node = containerRef?.current;
      const items = focusableInside(node);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose, containerRef]);
}

export default useModalDismiss;
