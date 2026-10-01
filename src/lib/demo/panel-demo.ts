import "server-only";

import { cookies } from "next/headers";

import type { PublicCatalog } from "@/types/catalog";
import type { Database } from "@/types/database";

export const DEMO_EMAIL = "demo@clickcatalogo.local";
export const DEMO_COOKIE_NAME = "catalogoja-demo";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const createdAt = "2026-07-19T12:00:00.000Z";

// A demonstração espelha a loja vitrine Ateliê Aurora (fotos reais do Pexels,
// licença livre). As imagens ficam em public/demo/atelie-aurora para funcionar
// em qualquer ambiente; o endereço próprio evita sobrescrever a loja real.
const DEMO_IMAGE = (name: string) => `/demo/atelie-aurora/${name}.webp`;

export const DEMO_TENANT: Database["public"]["Tables"]["tenants"]["Row"] = {
  banner_somente: false,
  banner_url: DEMO_IMAGE("banner"),
  canceled_at: null,
  created_at: createdAt,
  draft_deletion_claimed_at: null,
  draft_last_seen_at: null,
  draft_reminder_claimed_at: null,
  draft_reminder_last_day: 0,
  email_confirmado_em: createdAt,
  lembretes_desativados_em: null,
  lembretes_token: "00000000-0000-4000-8000-000000000000",
  descricao_curta: "Velas, cerâmicas e presentes artesanais feitos em pequenos lotes para transformar pequenos momentos.",
  endereco: "Rua das Flores, 120 — Centro",
  entrega_modo: "ambos",
  entrega_observacao: "Entregamos no centro; taxa combinada pelo WhatsApp.",
  formas_pagamento: ["pix", "credito", "dinheiro"],
  horario_atendimento: "Seg a sáb, das 9h às 18h",
  id: "00000000-0000-4000-8000-000000000010",
  instagram: null,
  logo_url: DEMO_IMAGE("logo"),
  nome_loja: "Ateliê Aurora",
  owner_user_id: DEMO_USER_ID,
  slug: "atelie-aurora-demo",
  status: "ativo",
  tema: "elegante",
  updated_at: createdAt,
  whatsapp: "5511999999999",
};

export const DEMO_CATEGORIES: Database["public"]["Tables"]["categories"]["Row"][] = [
  { created_at: createdAt, id: "00000000-0000-4000-8000-000000000101", nome: "Novidades", ordem: 0, tenant_id: DEMO_TENANT.id, updated_at: createdAt },
  { created_at: createdAt, id: "00000000-0000-4000-8000-000000000102", nome: "Velas e aromas", ordem: 1, tenant_id: DEMO_TENANT.id, updated_at: createdAt },
  { created_at: createdAt, id: "00000000-0000-4000-8000-000000000103", nome: "Casa e afeto", ordem: 2, tenant_id: DEMO_TENANT.id, updated_at: createdAt },
  { created_at: createdAt, id: "00000000-0000-4000-8000-000000000104", nome: "Para presentear", ordem: 3, tenant_id: DEMO_TENANT.id, updated_at: createdAt },
];

const demoProduct = (
  index: number,
  categoryIndex: number,
  ordem: number,
  image: string,
  nome: string,
  preco: number,
  descricao: string,
  variacao_info: string | null,
  ativo = true,
): Database["public"]["Tables"]["products"]["Row"] => ({
  ativo,
  category_id: DEMO_CATEGORIES[categoryIndex].id,
  created_at: createdAt,
  descricao,
  id: `00000000-0000-4000-8000-000000000${String(200 + index)}`,
  imagem_url: DEMO_IMAGE(image),
  link_externo: null,
  nome,
  ordem,
  preco,
  tenant_id: DEMO_TENANT.id,
  updated_at: createdAt,
  variacao_info,
});

export const DEMO_PRODUCTS: Database["public"]["Tables"]["products"]["Row"][] = [
  demoProduct(1, 0, 0, "kit-afeto", "Kit Afeto", 84.9, "Caixa kraft com duas velas artesanais e cortador de pavio dourado.", "Escolha o aroma das velas"),
  demoProduct(2, 0, 1, "vela-aurora", "Vela Aurora", 42, "Vela de cera vegetal em pote de vidro com tampa, produzida em pequenos lotes.", "Lavanda, baunilha ou capim-limão"),
  demoProduct(3, 0, 2, "caneca-orvalho", "Caneca Orvalho", 49.9, "Caneca de cerâmica feita à mão, com esmalte verde e acabamento rústico.", "Peças únicas, com pequenas variações de cor"),
  demoProduct(4, 1, 0, "vela-jardim", "Vela Jardim", 38, "Aroma floral delicado em pote de vidro reutilizável.", "180 g"),
  demoProduct(5, 1, 1, "vela-aconchego", "Vela Aconchego", 46, "Notas quentes de baunilha e madeira em pote âmbar.", "220 g"),
  demoProduct(6, 1, 2, "difusor-brisa", "Difusor Brisa", 64.9, "Difusor de varetas em frasco âmbar que perfuma o ambiente por semanas.", "Alecrim, flor de laranjeira ou bambu"),
  demoProduct(7, 2, 0, "xicaras-areia", "Conjunto Xícaras Areia", 89.9, "Xícaras de cerâmica artesanal em tom areia, modeladas à mão.", "Conjunto com 4 peças"),
  demoProduct(8, 2, 1, "bolsa-essencial", "Bolsa Essencial", 69.9, "Ecobag de algodão cru, leve e resistente para a rotina.", "40 × 35 cm"),
  demoProduct(9, 2, 2, "vasos-nuvem", "Trio de Vasos Nuvem", 79.9, "Três mini vasos de cerâmica branca para flores secas.", "Flores secas não inclusas"),
  demoProduct(10, 3, 0, "caixa-celebracao", "Caixa Celebração", 119.9, "Velas artesanais embaladas com flores secas para aniversários e datas especiais.", "Cartão com mensagem personalizada"),
  demoProduct(11, 3, 1, "pequenos-momentos", "Presente Pequenos Momentos", 59.9, "Vela aromática em caixa kraft com laço de cetim.", "Laço vermelho ou rosé"),
  demoProduct(12, 3, 2, "kit-aconchegante", "Kit Casa Aconchegante", 139.9, "Caneca de cerâmica e vela aromática para pausas tranquilas em casa.", "Embalagem para presente"),
  // Item oculto para a demonstração mostrar também o estado "Oculto" no painel.
  demoProduct(13, 1, 3, "vela-aconchego", "Vela Edição de Inverno", 52, "Edição sazonal com notas de canela e cravo.", "Volta em junho", false),
];

export const DEMO_SUBSCRIPTION: Database["public"]["Tables"]["subscriptions"]["Row"] = {
  access_until: null,
  asaas_customer_id: "cus_demo",
  asaas_subscription_id: "sub_demo",
  asaas_subscription_state: "active",
  cancel_at_period_end: false,
  cancellation_reconciliation_checked_at: null,
  cancellation_reconciliation_status: "not_required",
  cancellation_requested_at: null,
  created_at: createdAt,
  id: "00000000-0000-4000-8000-000000000301",
  next_due_date: "2026-08-19",
  overdue_cancellation_checked_at: null,
  overdue_cancellation_status: "not_required",
  overdue_invoice_url: null,
  overdue_last_notice_day: 0,
  overdue_notice_claimed_at: null,
  overdue_since: null,
  portal_url: null,
  reactivation_requested_at: null,
  status: "ativo",
  tenant_id: DEMO_TENANT.id,
  updated_at: createdAt,
  valor: 27,
};

// Números ilustrativos do card "Sua loja esta semana" no modo demonstração.
export const DEMO_STORE_STATS = [
  { current: 184, event: "catalog_view", previous: 152 },
  { current: 23, event: "whatsapp_order_clicked", previous: 17 },
  { current: 9, event: "catalog_shared", previous: 11 },
] as const satisfies readonly { current: number; event: "catalog_shared" | "catalog_view" | "whatsapp_order_clicked"; previous: number }[];

export const DEMO_CATALOG: PublicCatalog = {
  banner_url: DEMO_TENANT.banner_url,
  categorias: DEMO_CATEGORIES.map((category) => ({
    id: category.id,
    nome: category.nome,
    ordem: category.ordem,
    produtos: DEMO_PRODUCTS.filter((product) => product.category_id === category.id && product.ativo).map((product) => ({
      descricao: product.descricao,
      id: product.id,
      imagem_url: product.imagem_url,
      link_externo: product.link_externo,
      nome: product.nome,
      ordem: product.ordem,
      preco: Number(product.preco),
      variacao_info: product.variacao_info,
    })),
  })),
  descricao_curta: DEMO_TENANT.descricao_curta,
  endereco: DEMO_TENANT.endereco,
  entrega_modo: DEMO_TENANT.entrega_modo,
  entrega_observacao: DEMO_TENANT.entrega_observacao,
  formas_pagamento: DEMO_TENANT.formas_pagamento,
  horario_atendimento: DEMO_TENANT.horario_atendimento,
  instagram: DEMO_TENANT.instagram,
  logo_url: DEMO_TENANT.logo_url,
  nome_loja: DEMO_TENANT.nome_loja,
  slug: DEMO_TENANT.slug,
  status: "ativo",
  tema: DEMO_TENANT.tema,
  whatsapp: DEMO_TENANT.whatsapp,
};

export function isDemoAccessEnabled() {
  return process.env.DEMO_ACCESS_ENABLED !== "false";
}

export async function hasDemoSession() {
  if (!isDemoAccessEnabled()) return false;
  return (await cookies()).get(DEMO_COOKIE_NAME)?.value === "1";
}
