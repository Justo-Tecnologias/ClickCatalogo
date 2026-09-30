// Destinos aceitos no botão "Ver oferta". O link externo é exibido dentro do
// domínio do ClickCatálogo, então só marketplaces conhecidos são permitidos
// para impedir que um catálogo seja usado como ponte para páginas de golpe.
// Cada domínio aceita também os seus subdomínios (ex.: produto.mercadolivre.com.br).
export const EXTERNAL_LINK_STORES = [
  { domains: ["mercadolivre.com.br", "mercadolivre.com", "mercadolibre.com", "meli.la"], name: "Mercado Livre" },
  { domains: ["shopee.com.br", "shope.ee"], name: "Shopee" },
  { domains: ["amazon.com.br", "amazon.com", "amzn.to", "a.co"], name: "Amazon" },
  { domains: ["magazineluiza.com.br", "magalu.com"], name: "Magalu" },
  { domains: ["aliexpress.com", "aliexpress.us"], name: "AliExpress" },
  { domains: ["shein.com", "shein.com.br"], name: "Shein" },
] as const;

export const EXTERNAL_LINK_STORE_NAMES = EXTERNAL_LINK_STORES.map((store) => store.name).join(", ");

const allowedDomains: readonly string[] = EXTERNAL_LINK_STORES.flatMap((store) => store.domains);

export function isAllowedExternalLink(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function allowedExternalLinkOrNull(value: string | null | undefined) {
  return value && isAllowedExternalLink(value) ? value : null;
}
