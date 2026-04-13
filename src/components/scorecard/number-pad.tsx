"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface NumberPadProps {
  onSelect: (value: number) => void;
  onClose: () => void;
  par: number;
  playerName: string;
  hole: number;
}

export function NumberPad({ onSelect, onClose, par, playerName, hole }: NumberPadProps) {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");

  // Focus the hidden input on mount so keyboard works immediately
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Backspace") {
        setTyped("");
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        const next = typed + e.key;
        const num = parseInt(next);
        // If two digits and valid, submit immediately
        if (next.length >= 2) {
          if (num >= 1 && num <= 12) {
            onSelect(num);
          }
          setTyped("");
          return;
        }
        // Single digit: if it can't be a prefix for 10-12, submit immediately
        if (num >= 2 && num <= 9) {
          onSelect(num);
          setTyped("");
          return;
        }
        // num is 1 or 0 — wait for second digit
        setTyped(next);
        return;
      }
      if (e.key === "Enter" && typed.length > 0) {
        const num = parseInt(typed);
        if (num >= 1 && num <= 12) {
          onSelect(num);
        }
        setTyped("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [typed, onSelect, onClose]);

  // Auto-submit after a short delay when "1" is typed (waiting for possible "10", "11", "12")
  useEffect(() => {
    if (typed === "1") {
      const timer = setTimeout(() => {
        onSelect(1);
        setTyped("");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [typed, onSelect]);

  function getLabel(n: number) {
    const diff = n - par;
    if (diff === -3) return "Albatross";
    if (diff === -2) return "Eagle";
    if (diff === -1) return "Birdie";
    if (diff === 0) return "Par";
    if (diff === 1) return "Bogey";
    if (diff === 2) return "Dbl Bogey";
    if (diff === 3) return "Triple";
    return `+${diff}`;
  }

  function getBg(n: number) {
    const diff = n - par;
    if (diff <= -2) return "bg-amber-50 border-amber-300 hover:bg-amber-100";
    if (diff === -1) return "bg-red-50 border-red-200 hover:bg-red-100";
    if (diff === 0) return "bg-[#f2f7f4] border-[#d4e4db] hover:bg-[#e5efe9]";
    if (diff === 1) return "bg-gray-50 border-gray-200 hover:bg-gray-100";
    return "bg-gray-100 border-gray-300 hover:bg-gray-200";
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
      {/* Hidden input to capture keyboard on mobile */}
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        className="sr-only"
        aria-hidden="true"
        value={typed}
        onChange={() => {}}
      />
      <div className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold">{playerName}</p>
            <p className="text-sm text-muted-foreground">
              Hole {hole} — Par {par}
              {typed && (
                <span className="ml-2 text-primary font-bold">
                  typing: {typed}_
                </span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Tap a number or just type it on your keyboard
        </p>

        <div className="grid grid-cols-4 gap-2">
          {numbers.map((n) => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${getBg(n)}`}
            >
              <span className="text-xl font-bold">{n}</span>
              <span className="text-[9px] text-muted-foreground">
                {getLabel(n)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
