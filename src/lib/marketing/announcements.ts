export type Announcement = {
  /** Destino da faixa; deve apontar para algo que já existe no produto. */
  href: string;
  /** Data em que a novidade entrou no ar (YYYY-MM-DD), para histórico. */
  since: string;
  text: string;
};

// Faixa de novidades da landing. Regra: somente funcionalidades JÁ publicadas.
// Nunca anunciar recurso futuro aqui (a oferta vincula o fornecedor) nem
// incluir datas de entregas planejadas. Use null para esconder a faixa.
export const CURRENT_ANNOUNCEMENT: Announcement | null = {
  href: "/como-funciona",
  since: "2026-10-02",
  text: "Monte sua loja grátis e pague só quando publicar",
};
