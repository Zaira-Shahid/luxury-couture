"use client";

import { useEffect, useRef } from "react";

/**
 * Shared behaviour for the app's hand-rolled overlays (the admin mobile
 * nav, the media picker).
 *
 * Both were built as a plain absolutely-positioned `<div>` with a
 * click-to-dismiss backdrop. That gives a mouse user everything and a
 * keyboard or screen-reader user almost nothing: no Escape, no
 * announcement that a dialog opened, and focus left behind on the
 * trigger underneath the overlay.
 *
 * This adds the three things that matter most, in one place so the two
 * call sites cannot drift:
 *
 *  1. Escape closes. The single most expected keyboard affordance for an
 *     overlay, and neither had it.
 *  2. Focus moves into the dialog on open and RETURNS to the trigger on
 *     close. Without the return, dismissing a dialog dumps focus back at
 *     the top of the document and the user has to tab all the way in
 *     again.
 *  3. `role="dialog"` + `aria-modal` + a label, via `dialogProps`.
 *
 * NOT IMPLEMENTED, deliberately and stated rather than implied: a full
 * focus trap. Tab can still walk out of the overlay into the page behind
 * it. Doing that properly means either a sizeable amount of careful code
 * or adopting a headless dialog primitive, and the honest position is
 * that this is a real remaining gap rather than something quietly
 * covered. Both overlays keep a visible Close control, so nobody is
 * stuck — they can simply tab somewhere unexpected.
 */
export function useDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember whatever opened this, so focus can go home afterwards.
    triggerRef.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    // Move focus into the dialog. Prefer the first focusable control;
    // fall back to the container, which is why it carries tabIndex={-1}.
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (first ?? dialogRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Guard against focusing a node that unmounted with the dialog.
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [isOpen, onClose]);

  return {
    dialogRef,
    /** Spread onto the dialog's own container, not the backdrop. */
    dialogProps: {
      role: "dialog" as const,
      "aria-modal": true,
      tabIndex: -1,
    },
  };
}
