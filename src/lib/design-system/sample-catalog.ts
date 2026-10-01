import type { PublicCatalog } from "@/types/catalog";
import { EMPTY_STORE_SERVICE_INFO } from "@/lib/catalog/store-info";

export const SAMPLE_CATALOG: PublicCatalog = {
  banner_url: null,
  categorias: [
    {
      id: "presentes",
      nome: "Presentes",
      ordem: 0,
      produtos: [
        {
          id: "vela-aurora",
          nome: "Vela Aurora",
          preco: 42.9,
          descricao: "Aroma suave de figo e folhas verdes.",
          imagem_url: "/demo/vela-aurora.svg",
          variacao_info: "Aromas: Figo, Baunilha ou Chá Branco",
          ordem: 0,
        },
        {
          id: "bolsa-essencial",
          nome: "Bolsa Essencial",
          preco: 89,
          descricao: "Leve, resistente e feita para todos os dias.",
          imagem_url: "/demo/bolsa-essencial.svg",
          variacao_info: "Cores: Areia, Oliva ou Terracota",
          ordem: 1,
        },
        {
          id: "kit-afeto",
          nome: "Kit Afeto",
          preco: 67.5,
          descricao: "Um presente delicado, pronto para entregar.",
          imagem_url: "/demo/kit-afeto.svg",
          variacao_info: "Inclui cartão com mensagem",
          ordem: 2,
        },
        {
          id: "caneca-orvalho",
          nome: "Caneca Orvalho",
          preco: 35,
          descricao: "Cerâmica artesanal de acabamento acetinado.",
          imagem_url: "/demo/caneca-orvalho.svg",
          variacao_info: "Capacidade: 320 ml",
          ordem: 3,
        },
      ],
    },
    {
      id: "casa",
      nome: "Casa",
      ordem: 1,
      produtos: [],
    },
    {
      id: "novidades",
      nome: "Novidades",
      ordem: 2,
      produtos: [],
    },
  ],
  descricao_curta: "Pequenos detalhes para presentear e deixar a casa mais bonita.",
  endereco: "Rua das Flores, 120 — Centro",
  ...EMPTY_STORE_SERVICE_INFO,
  instagram: "atelieaurora",
  logo_url: null,
  nome_loja: "Ateliê Aurora",
  slug: "atelie-aurora",
  status: "ativo",
  tema: "natural",
  whatsapp: "5511999999999",
};
