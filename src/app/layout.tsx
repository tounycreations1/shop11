import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "فرشة Farsha | شارع تسوّق مباشر",
  description:
    "تجوّل في شارع فرشة المباشر: 100 محل بواجهات ولافتات حقيقية، منتجات وخدمات وعروض مباشرة، ودليل ذكي يأخذك إلى باب كل محل.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050b11",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#050b11] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
