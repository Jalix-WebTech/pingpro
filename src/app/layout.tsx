import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PingPro — Encrypted Professional Messenger",
  description:
    "Real-time end-to-end encrypted professional messaging. WhatsApp-style chats, groups, statuses and calls.",
};

export const viewport: Viewport = {
  themeColor: "#008069",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b141a] text-slate-900 antialiased">{children}</body>
    </html>
  );
}
