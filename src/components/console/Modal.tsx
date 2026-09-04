"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { TYPE } from "@/components/console/ui";

/**
 * Console dialog.
 *
 * One surface over the page, never a card in a card. Escape and the overlay
 * dismiss it; the primary action lives in the footer.
 */
export function ConsoleModal({
  open,
  title,
  hint,
  onClose,
  children,
  footer,
  labelledBy,
  closeLabel = "Close",
  size = "md",
  layer = 50,
}: {
  open: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
  closeLabel?: string;
  size?: "md" | "lg";
  layer?: number;
}) {
  const titleId = labelledBy ?? "console-modal-title";

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center p-4 sm:items-center"
      style={{ zIndex: layer }}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default"
        style={{ background: "var(--edl-overlay)" }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`console-card relative z-10 flex max-h-[min(40rem,calc(100svh-2rem))] w-full flex-col bg-[var(--edl-bg)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ${
          size === "lg" ? "max-w-[36rem]" : "max-w-[32rem]"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--edl-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className={TYPE.h2}>
              {title}
            </h2>
            {hint ? <p className={`mt-0.5 ${TYPE.meta}`}>{hint}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="console-btn-quiet shrink-0 p-1"
            aria-label={closeLabel}
          >
            <X size={14} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--edl-border)] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
