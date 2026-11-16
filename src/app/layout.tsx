import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#FAF9F7] text-[#18181B] antialiased selection:bg-[#FDF2EF] selection:text-[#E04F33] dark:bg-[#111113] dark:text-[#F4F4F5]">
        {children}
      </body>
    </html>
  );
}
