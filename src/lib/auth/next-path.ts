/**
 * Destino após o login (ex.: links dos lembretes). Só aceita telas do painel
 * do próprio site, para não virar redirecionamento aberto.
 */
export function safePanelNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\/painel\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(value)) return null;
  return value;
}
