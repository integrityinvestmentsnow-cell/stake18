import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stake18 Golf — Live Skins Scoring",
  description:
    "Live scoring, skins tracking, and golf betting with your group. No download required.",
  manifest: "/manifest.json",
  themeColor: "#006747",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stake18",
  },
  openGraph: {
    title: "Stake18 Golf — Live Skins Scoring",
    description: "Live scoring, skins tracking, and golf betting with your group.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
