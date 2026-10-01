import { MARKETING_OG_SIZE, renderMarketingOgImage } from "@/lib/marketing/og-image";

export const alt = "ClickCatálogo — sua loja no WhatsApp em minutos";
export const contentType = "image/png";
export const runtime = "nodejs";
export const size = MARKETING_OG_SIZE;

export default function OpenGraphImage() {
  return renderMarketingOgImage({
    subtitle: "Catálogo digital bonito e pedidos organizados direto no seu WhatsApp.",
    title: "Sua loja no WhatsApp em minutos",
  });
}
