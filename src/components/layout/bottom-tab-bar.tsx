"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Trophy, Users, Menu, Pencil } from "lucide-react";

const tabs = [
  { href: "", label: "Home", Icon: Home },
  { href: "leaderboard", label: "Leader Board", Icon: Trophy },
  { href: "scorecard", label: "My Group", Icon: Pencil },
  { href: "skins", label: "Skins", Icon: Users },
  { href: "feed", label: "More", Icon: Menu },
];

export function BottomTabBar({ tournamentId }: { tournamentId: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#d4e4db] z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const href = tab.href
            ? `/t/${tournamentId}/${tab.href}`
            : `/t/${tournamentId}`;
          const isActive = pathname === href;

          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 px-2 min-w-[60px] transition-colors",
                isActive
                  ? "text-[#006747]"
                  : "text-[#999] hover:text-[#006747]"
              )}
            >
              <tab.Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "font-bold" : "font-medium"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
