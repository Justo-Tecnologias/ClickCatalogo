import { ImageResponse } from "next/og";

import { getPublicStore } from "@/lib/catalog/public-catalog";

export const alt = "Catálogo de loja no ClickCatálogo";
export const contentType = "image/png";
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
  const description = catalog?.descricao_curta ?? (available
    ? "Veja os produtos e faça seu pedido pelo WhatsApp."
    : "Catálogo digital simples para vender pelo WhatsApp.");

  return new ImageResponse(
    <div style={{ alignItems: "center", background: theme.background, color: theme.foreground, display: "flex", height: "100%", justifyContent: "center", padding: 64, position: "relative", width: "100%" }}>
      <div style={{ background: theme.accent, borderRadius: 999, height: 360, opacity: 0.13, position: "absolute", right: -80, top: -100, width: 360 }} />
      <div style={{ alignItems: "center", display: "flex", gap: 48, width: "100%" }}>
        <div style={{ alignItems: "center", background: theme.accent, borderRadius: 44, color: "white", display: "flex", fontSize: 84, fontWeight: 800, height: 220, justifyContent: "center", overflow: "hidden", width: 220 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
          <div style={{ color: theme.accent, display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>Catálogo da loja</div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 850, letterSpacing: -2, lineHeight: 1.05, marginTop: 18 }}>{name}</div>
          <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, marginTop: 24, opacity: 0.78 }}>{description.slice(0, 150)}</div>
          <div style={{ alignItems: "center", display: "flex", fontSize: 24, fontWeight: 700, gap: 12, marginTop: 36 }}><span style={{ background: theme.accent, borderRadius: 999, display: "flex", height: 12, width: 12 }} />Pedido direto pelo WhatsApp</div>
        </div>
      </div>
      <div style={{ bottom: 34, display: "flex", fontSize: 20, fontWeight: 700, opacity: 0.65, position: "absolute", right: 50 }}>ClickCatálogo</div>
    </div>,
    size,
  );
}
