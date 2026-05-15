import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiscal — Análisis SAT/TFJA",
  description: "Sistema de análisis fiscal y administrativo mexicano",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
