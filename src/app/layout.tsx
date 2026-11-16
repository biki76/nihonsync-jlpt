import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-ui",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NihonSync — JLPT Mock Test Platform (N5–N1)",
  description:
    "Authentic JLPT mock exam simulator with automated sectional grading, restricted listening audio, and 8-language answer reviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${notoSansJP.variable}`}>
      <body className="min-h-screen bg-[#FAF9F7] text-[#18181B] antialiased selection:bg-[#FDF2EF] selection:text-[#E04F33] dark:bg-[#111113] dark:text-[#F4F4F5]">
        {children}
      </body>
    </html>
  );
}
