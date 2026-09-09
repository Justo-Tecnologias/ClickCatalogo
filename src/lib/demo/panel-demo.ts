import "server-only";

import { cookies } from "next/headers";

import type { PublicCatalog } from "@/types/catalog";
import type { Database } from "@/types/database";

export const DEMO_EMAIL = "demo@clickcatalogo.local";
export const DEMO_COOKIE_NAME = "catalogoja-demo";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const createdAt = "2026-07-19T12:00:00.000Z";

export const DEMO_TENANT: Database["public"]["Tables"]["tenants"]["Row"] = {
  banner_url: null,
  canceled_at: null,
  created_at: createdAt,
  descricao_curta: "Cafés, presentes e pequenos momentos preparados com carinho.",
  endereco: "Praça Central, 27 — Centro",
  id: "00000000-0000-4000-8000-000000000010",
  instagram: "cafedapraca",
  logo_url: null,
  nome_loja: "Café da Praça",
  owner_user_id: DEMO_USER_ID,
  slug: "cafe-da-praca-demo",
  status: "ativo",
  tema: "natural",
  updated_at: createdAt,
  whatsapp: "5511999999999",
};

export const DEMO_CATEGORIES: Database["public"]["Tables"]["categories"]["Row"][] = [
  { created_at: createdAt, id: "00000000-0000-4000-8000-000000000101", nome: "Cafés", ordem: 0, tenant_id: DEMO_TENANT.id, updated_at: createdAt },
  { created_at: createdAt, id: "00000000-0000-4000-8000-000000000102", nome: "Presentes", ordem: 1, tenant_id: DEMO_TENANT.id, updated_at: createdAt },
];

export const DEMO_PRODUCTS: Database["public"]["Tables"]["products"]["Row"][] = [
  { ativo: true, category_id: DEMO_CATEGORIES[0].id, created_at: createdAt, descricao: "Café coado na hora, com grãos selecionados.", id: "00000000-0000-4000-8000-000000000201", imagem_url: "/demo/caneca-orvalho.svg", nome: "Café especial", ordem: 0, preco: 12, tenant_id: DEMO_TENANT.id, updated_at: createdAt, variacao_info: "Pequeno ou grande" },
  { ativo: true, category_id: DEMO_CATEGORIES[1].id, created_at: createdAt, descricao: "Uma seleção delicada para presentear.", id: "00000000-0000-4000-8000-000000000202", imagem_url: "/demo/kit-afeto.svg", nome: "Kit carinho", ordem: 0, preco: 59.9, tenant_id: DEMO_TENANT.id, updated_at: createdAt, variacao_info: "Cartão personalizado incluso" },
  { ativo: false, category_id: DEMO_CATEGORIES[1].id, created_at: createdAt, descricao: "Caneca artesanal em edição limitada.", id: "00000000-0000-4000-8000-000000000203", imagem_url: "/demo/vela-aurora.svg", nome: "Caneca artesanal", ordem: 1, preco: 42, tenant_id: DEMO_TENANT.id, updated_at: createdAt, variacao_info: null },
];

export const DEMO_SUBSCRIPTION: Database["public"]["Tables"]["subscriptions"]["Row"] = {
  asaas_customer_id: "cus_demo",
  asaas_subscription_id: "sub_demo",
  created_at: createdAt,
  id: "00000000-0000-4000-8000-000000000301",
  next_due_date: "2026-08-19",
  portal_url: null,
  status: "ativo",
  tenant_id: DEMO_TENANT.id,
  updated_at: createdAt,
  valor: 27,
};

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
      nome: product.nome,
      ordem: product.ordem,
      preco: Number(product.preco),
      variacao_info: product.variacao_info,
    })),
  })),
  descricao_curta: DEMO_TENANT.descricao_curta,
  endereco: DEMO_TENANT.endereco,
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
