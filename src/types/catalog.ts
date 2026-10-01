import type { StoreServiceInfo } from "@/lib/catalog/store-info";
import type { TenantStatus, TenantTheme } from "@/types/database";

export type CatalogProduct = {
  descricao: string | null;
  id: string;
  imagem_url: string | null;
  link_externo?: string | null;
  nome: string;
  ordem: number;
  preco: number;
  variacao_info: string | null;
};

export type CatalogCategory = {
  id: string;
  nome: string;
  ordem: number;
  produtos: CatalogProduct[];
};

export type PublicCatalog = StoreServiceInfo & {
  /** Topo só com o banner (migration 028); ausente equivale a false. */
  banner_somente?: boolean;
  banner_url: string | null;
  categorias: CatalogCategory[];
  descricao_curta: string | null;
  endereco: string | null;
  instagram: string | null;
  logo_url: string | null;
  nome_loja: string;
  slug: string;
  status: Extract<TenantStatus, "ativo" | "inadimplente">;
  tema: TenantTheme;
  whatsapp: string;
};
