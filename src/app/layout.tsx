import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NihonSync JLPT | Authentic JLPT Mock Exams",
  description: "Timed JLPT N5-N1 mock tests with furigana support, listening audio, and multilingual explanations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://googleapis.com" />
        <link rel="preconnect" href="https://gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#FAFAFA] text-[#1E293B] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
