import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRS Interno",
  // Sistema interno nao e indexado em hipotese alguma.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
