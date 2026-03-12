import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiambrieria App",
  description: "App de vendedores y panel admin para gestion de visitas semanales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

