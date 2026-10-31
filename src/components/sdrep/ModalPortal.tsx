import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalPortalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  className?: string;
  closeOnBackdropClick?: boolean;
}

/**
 * Universal Modal Portal for SDREP.
 * Attaches directly to document.body via React portal to guarantee
 * zero z-index conflicts or clipping from map canvases or parent panels.
 */
export function ModalPortal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-2xl",
  className,
  closeOnBackdropClick = true,
}: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and bind Escape key listener while open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-modal-backdrop flex items-center justify-center p-3 sm:p-5"
    >
      {/* Darkened contextual backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog Window */}
      <div
        className={cn(
          "relative z-modal flex flex-col w-full rounded-xl border border-border bg-surface text-foreground shadow-2xl duration-200 animate-in fade-in zoom-in-95",
          "max-h-[88vh] overflow-hidden",
          maxWidth,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4 shrink-0">
            <div className="min-w-0 flex-1">
              {title && <div className="text-base font-bold text-foreground">{title}</div>}
              {description && (
                <div className="mt-1 text-xs text-muted-foreground">{description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
