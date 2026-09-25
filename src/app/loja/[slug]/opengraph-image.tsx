import { ImageResponse } from "next/og";
import sharp from "sharp";

import { getPublicStore } from "@/lib/catalog/public-catalog";

export const alt = "Catálogo de loja no ClickCatálogo";
export const contentType = "image/png";
export const runtime = "nodejs";
export const size = { height: 630, width: 1200 };

const colors = {
  classico: { accent: "#a47a1f", background: "#f4ecdb", foreground: "#1b2723" },
  delivery: { accent: "#c84d18", background: "#fff5ef", foreground: "#2b211d" },
  elegante: { accent: "#dca58f", background: "#121212", foreground: "#ffffff" },
  minimal: { accent: "#5d6870", background: "#f7f8f8", foreground: "#111827" },
  natural: { accent: "#627941", background: "#f2ecdc", foreground: "#17382d" },
  tech: { accent: "#0863d7", background: "#eef5ff", foreground: "#102a43" },
} as const;

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublicStore(slug);
  const available = result.kind === "available";
  const catalog = available ? result.catalog : null;
  const theme = colors[catalog?.tema ?? "natural"];
  const name = catalog?.nome_loja ?? "ClickCatálogo";
  const hasExternalOffers = catalog?.categorias.some((category) =>
    category.produtos.some((product) => Boolean(product.link_externo))) ?? false;
  const description = catalog?.descricao_curta?.trim() || (available
    ? "Veja os produtos disponíveis neste catálogo."
    : "Catálogo digital simples para divulgar produtos e vender mais.");
  const action = hasExternalOffers
    ? "Confira produtos e ofertas"
    : "Escolha os produtos e peça pelo WhatsApp";
  const logoSource = await getLogoSource(catalog?.logo_url ?? null);

  return new ImageResponse(
    <div style={{ background: theme.background, color: theme.foreground, display: "flex", height: "100%", overflow: "hidden", position: "relative", width: "100%" }}>
      <div style={{ background: theme.accent, display: "flex", height: "100%", left: 0, opacity: 0.08, position: "absolute", top: 0, width: 455 }} />
      <div style={{ background: theme.accent, borderRadius: 999, display: "flex", height: 380, opacity: 0.1, position: "absolute", right: -130, top: -160, width: 380 }} />

      <div style={{ alignItems: "center", display: "flex", flexShrink: 0, height: "100%", justifyContent: "center", padding: "70px 42px 70px 62px", width: 455 }}>
        <div style={{ alignItems: "center", background: "#ffffff", border: `8px solid ${theme.accent}`, borderRadius: 42, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", display: "flex", height: 350, justifyContent: "center", overflow: "hidden", padding: 20, width: 350 }}>
          {logoSource ? (
            // A tag nativa é necessária porque ImageResponse não renderiza next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" height="310" src={logoSource} style={{ height: 310, objectFit: "contain", width: 310 }} width="310" />
          ) : (
            <div style={{ alignItems: "center", background: theme.accent, borderRadius: 32, color: "#ffffff", display: "flex", fontSize: 116, fontWeight: 850, height: 290, justifyContent: "center", width: 290 }}>
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "64px 68px 72px 54px" }}>
        <div style={{ color: theme.accent, display: "flex", fontSize: 23, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>
          Catálogo online
        </div>
        <div style={{ display: "flex", fontSize: name.length > 24 ? 58 : 70, fontWeight: 850, letterSpacing: -2.5, lineHeight: 1.02, marginTop: 16 }}>
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 29, lineHeight: 1.35, marginTop: 22, maxWidth: 630, opacity: 0.82 }}>
          {description.slice(0, 120)}
        </div>
        <div style={{ alignItems: "center", alignSelf: "flex-start", background: theme.accent, borderRadius: 999, color: "#ffffff", display: "flex", fontSize: 23, fontWeight: 750, marginTop: 34, padding: "15px 24px" }}>
          {action}
        </div>
      </div>

      <div style={{ alignItems: "center", bottom: 26, display: "flex", fontSize: 19, fontWeight: 750, gap: 9, opacity: 0.68, position: "absolute", right: 42 }}>
        <span style={{ background: theme.accent, borderRadius: 6, display: "flex", height: 18, width: 18 }} />
        ClickCatálogo
      </div>
    </div>,
    size,
  );
}

async function getLogoSource(url: string | null) {
  if (!url) return null;

  try {
    const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;
    const logoUrl = new URL(url);
    if (!storageOrigin || logoUrl.origin !== storageOrigin) return null;

    const response = await fetch(logoUrl, { cache: "force-cache" });
    if (!response.ok) return null;

    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength > 4_000_000) return null;

    const png = await sharp(source)
      .trim({ background: "#ffffff", threshold: 10 })
      .resize(620, 620, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
