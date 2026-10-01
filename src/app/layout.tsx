import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

import { getSiteUrl } from "@/lib/env/server";

const siteUrl = getSiteUrl();
const siteDescription = "Crie seu catálogo digital e receba pedidos pelo WhatsApp.";

export const metadata: Metadata = {
  applicationName: "ClickCatálogo",
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: siteDescription,
    locale: "pt_BR",
    siteName: "ClickCatálogo",
    title: "ClickCatálogo",
    type: "website",
    url: siteUrl,
  },
  title: {
    default: "ClickCatálogo",
    template: "%s | ClickCatálogo",
  },
  // Usa a imagem Open Graph também no cartão grande do X/Twitter e similares.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
