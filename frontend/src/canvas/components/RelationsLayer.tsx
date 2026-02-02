// frontend/src/canvas/components/RelationLabel.tsx
import React from "react";
import type { RelationKind } from "./RelationsSvg";

export default function RelationLabel({
  id,
  x,
  y,
  kind,
  open,
  onToggle,
  onPick,
}: {
  id: string;
  x: number;
  y: number;
  kind: RelationKind;
  open: boolean;
  onToggle: (id: string) => void;
  onPick: (id: string, next: RelationKind) => void;
}) {
  const labelText = kind === "one-to-one" ? "1:1" : kind === "one-to-many" ? "1:N" : "N:M";

  return (
    <div
      className="absolute z-50 pointer-events-auto"
      style={{
        left: x - 28,
        top: y - 32,
        width: 70,
        height: 32,
        transform: "translateZ(0)",
      }}
    >
      {/* Контейнер метки */}
      <div
        className={`relative rounded-lg px-2 py-1 text-center select-none shadow-lg border backdrop-blur-sm transition-all duration-200 ${
          open ? "z-50" : "z-40"
        }`}
        style={{
          background: open 
            ? "rgba(139, 92, 246, 0.95)" 
            : "rgba(17, 24, 39, 0.85)",
          color: open ? "#ffffff" : "#e5e7eb",
          borderColor: open 
            ? "rgba(255, 255, 255, 0.3)" 
            : "rgba(139, 92, 246, 0.5)",
          borderWidth: "1.5px",
          boxShadow: open 
            ? "0 4px 12px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)" 
            : "0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "600",
          letterSpacing: "0.3px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-1">
          <span className="leading-none">{labelText}</span>
          <svg 
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Выпадающее меню */}
        {open && (
          <div
            className="absolute left-1/2 transform -translate-x-1/2 top-8 rounded-lg shadow-2xl border transition-all duration-200 overflow-hidden z-[60]"
            style={{
              background: "rgba(17, 24, 39, 0.98)",
              borderColor: "rgba(139, 92, 246, 0.6)",
              backdropFilter: "blur(12px)",
              minWidth: "100px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              <button
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-600/30 transition-colors flex items-center justify-between ${
                  kind === "one-to-one" ? "text-indigo-300 bg-indigo-600/20" : "text-gray-300"
                }`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onPick(id, "one-to-one"); 
                }}
              >
                <span>1:1</span>
                {kind === "one-to-one" && (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-600/30 transition-colors flex items-center justify-between ${
                  kind === "one-to-many" ? "text-indigo-300 bg-indigo-600/20" : "text-gray-300"
                }`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onPick(id, "one-to-many"); 
                }}
              >
                <span>1:N</span>
                {kind === "one-to-many" && (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-600/30 transition-colors flex items-center justify-between ${
                  kind === "many-to-many" ? "text-indigo-300 bg-indigo-600/20" : "text-gray-300"
                }`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onPick(id, "many-to-many"); 
                }}
              >
                <span>N:M</span>
                {kind === "many-to-many" && (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}