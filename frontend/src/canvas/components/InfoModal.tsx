// frontend/src/canvas/components/InfoModal.tsx
import React from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  type?: "info" | "warning" | "error";
};

export default function InfoModal({
  open,
  title = "Информация",
  message,
  confirmText = "ОК",
  onConfirm,
  onCancel,
  type = "info",
}: Props) {
  // Esc / Enter
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCancel) onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onConfirm, onCancel]);

  // Блокировка скролла
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // Цвета в зависимости от типа
  const getColors = () => {
    switch (type) {
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/20",
          border: "border-amber-200 dark:border-amber-700",
          title: "text-amber-800 dark:text-amber-200",
          icon: "",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
        };
      case "error":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-700",
          title: "text-red-800 dark:text-red-200",
          icon: "",
          button: "bg-red-600 hover:bg-red-700 text-white",
        };
      default: // info
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-700",
          title: "text-blue-800 dark:text-blue-200",
          icon: "",
          button: "bg-blue-600 hover:bg-blue-700 text-white",
        };
    }
  };

  const colors = getColors();

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      {/* Подложка */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Карточка */}
      <div className={`relative z-10 w-[min(92vw,480px)] rounded-2xl border ${colors.border} ${colors.bg} p-6 shadow-2xl`}>
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl" role="img" aria-hidden="true">
            {colors.icon}
          </span>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${colors.title} mb-1`}>
              {title}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            className={`px-4 py-2 rounded-lg font-medium ${colors.button} transition-colors duration-200`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}