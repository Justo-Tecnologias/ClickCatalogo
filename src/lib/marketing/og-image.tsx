import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { BRAND_COLORS as brand } from "@/lib/design-system/theme-colors";

// Imagem de compartilhamento das páginas institucionais (landing e /como-funciona).
// Cada página tem um opengraph-image no próprio segmento, porque o openGraph
// definido na página substitui o herdado do layout e descartaria a imagem.
export const MARKETING_OG_SIZE = { height: 630, width: 1200 };

async function phoneScreenshot() {
  // ImageResponse não decodifica WebP; o print é convertido para PNG.
  const source = await readFile(path.join(process.cwd(), "public", "como-funciona", "loja-celular.webp"));
  const png = await sharp(source).resize(500).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function renderMarketingOgImage({ subtitle, title }: { subtitle: string; title: string }) {
  const screenshot = await phoneScreenshot();

  return new ImageResponse(
    <div style={{ background: brand.brand50, color: brand.brand900, display: "flex", height: "100%", overflow: "hidden", position: "relative", width: "100%" }}>
      <div style={{ background: brand.accent, borderRadius: 999, display: "flex", height: 520, opacity: 0.45, position: "absolute", right: -120, top: -200, width: 520 }} />
      <div style={{ background: brand.brand100, borderRadius: 999, display: "flex", height: 420, position: "absolute", right: 120, bottom: -220, width: 420 }} />

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "0 40px 0 72px" }}>
        <div style={{ alignItems: "center", display: "flex", fontSize: 30, fontWeight: 800, gap: 14 }}>
          <div style={{ alignItems: "center", background: brand.brand900, borderRadius: 14, display: "flex", height: 46, justifyContent: "center", width: 46 }}>
            {/* Ícone de sacola do logo (mesmo desenho do lucide ShoppingBag). */}
            <svg fill="none" height="24" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          ClickCatálogo
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 850, letterSpacing: -2.5, lineHeight: 1.04, marginTop: 34, maxWidth: 640 }}>
          {title}
        </div>
        <div style={{ color: brand.muted, display: "flex", fontSize: 28, lineHeight: 1.4, marginTop: 24, maxWidth: 600 }}>
          {subtitle}
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 16, marginTop: 36 }}>
          <div style={{ background: brand.brand900, borderRadius: 999, color: "white", display: "flex", fontSize: 24, fontWeight: 750, padding: "14px 26px" }}>
            R$ 27/mês
          </div>
          <div style={{ color: brand.brand700, display: "flex", fontSize: 24, fontWeight: 700 }}>
            Sem comissão sobre as vendas
          </div>
        </div>
      </div>

      <div style={{ alignItems: "center", display: "flex", justifyContent: "center", paddingRight: 80, width: 400 }}>
        <div style={{ background: brand.brand900, borderRadius: 44, boxShadow: "0 30px 70px rgba(19, 50, 41, 0.28)", display: "flex", padding: 10 }}>
          {/* A tag nativa é necessária porque ImageResponse não renderiza next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse exige <img>; arquivo fora da convenção opengraph-image */}
          <img alt="" height={540} src={screenshot} style={{ borderRadius: 34, height: 540, objectFit: "cover", objectPosition: "top", width: 250 }} width={250} />
        </div>
      </div>
    </div>,
    MARKETING_OG_SIZE,
  );
}
