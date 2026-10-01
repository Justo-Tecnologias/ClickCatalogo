import { MARKETING_OG_SIZE, renderMarketingOgImage } from "@/lib/marketing/og-image";

export const alt = "Como funciona o ClickCatálogo";
export const contentType = "image/png";
export const runtime = "nodejs";
export const size = MARKETING_OG_SIZE;

export default function OpenGraphImage() {
  return renderMarketingOgImage({
    subtitle: "Veja com telas reais como funciona o ClickCatálogo, passo a passo.",
    title: "Do cadastro ao primeiro pedido no WhatsApp",
  });
}
