import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8
);

export function generateTournamentId(): string {
  return nanoid();
}

export function scoreColor(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -2) return "text-amber-600"; // eagle or better
  if (diff === -1) return "text-red-600"; // birdie (red = under par, Masters style)
  if (diff === 0) return "text-[#006747]"; // par
  if (diff === 1) return "text-[#555]"; // bogey
  return "text-[#333]"; // double+
}

export function scoreBgColor(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -2) return "bg-amber-50 border-amber-300"; // eagle
  if (diff === -1) return "bg-red-50 border-red-200"; // birdie
  if (diff === 0) return "bg-[#f2f7f4] border-[#d4e4db]"; // par
  if (diff === 1) return "bg-gray-50 border-gray-200"; // bogey
  return "bg-gray-100 border-gray-300"; // double+
}
