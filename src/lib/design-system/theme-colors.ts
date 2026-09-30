import type { TenantTheme } from "@/types/database";

// Cópia dos tokens de src/styles/themes.css para contextos que não leem CSS,
// como a imagem Open Graph gerada no servidor. `npm run check:contrast` falha
// se algum valor divergir do CSS, mantendo o arquivo CSS como fonte única.
//   background = --cor-fundo, foreground = --cor-texto,
//   accent = --cor-acao, accentText = --cor-na-acao
export const THEME_COLORS = {
  classico: { accent: "#8f6b20", accentText: "#ffffff", background: "#f8f4ea", foreground: "#2e2b27" },
  natural: { accent: "#5a6c35", accentText: "#ffffff", background: "#f2ebdd", foreground: "#263b2f" },
  tech: { accent: "#0b5fd7", accentText: "#ffffff", background: "#f2f5f8", foreground: "#0d2947" },
  delivery: { accent: "#b84916", accentText: "#ffffff", background: "#fffaf5", foreground: "#47291f" },
  elegante: { accent: "#d6a58d", accentText: "#1b1210", background: "#0e0e0f", foreground: "#f7f3ef" },
  minimal: { accent: "#4e5963", accentText: "#ffffff", background: "#ffffff", foreground: "#111214" },
} as const satisfies Record<TenantTheme, { accent: string; accentText: string; background: string; foreground: string }>;
