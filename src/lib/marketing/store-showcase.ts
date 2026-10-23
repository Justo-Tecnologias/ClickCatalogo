import type { StoreServiceInfo } from "@/lib/catalog/store-info";
import { THEMES } from "@/lib/design-system/themes";
import type { PublicCatalog } from "@/types/catalog";
import type { TenantTheme } from "@/types/database";

// "Sua loja em 10 segundos" (/exemplo): prévia montada com o nome digitado e
// produtos de exemplo do nicho. Nada é salvo; a página só lê a URL.
// Fotos: public/nichos/ (Unsplash, licença gratuita; origem em docs/FOTOS-NICHOS.md)
// e, no artesanato, as da loja de demonstração Ateliê Aurora.

type ShowcaseProduct = {
  descricao: string;
  imagem: string;
  nome: string;
  preco: number;
  variacao: string | null;
};

type ShowcaseNicheTemplate = {
  banner: string;
  categorias: { nome: string; produtos: ShowcaseProduct[] }[];
  descricao: string;
  label: string;
  servico: StoreServiceInfo;
  tema: TenantTheme;
};

const nicho = (folder: string, name: string) => `/nichos/${folder}/${name}.webp`;
const aurora = (name: string) => `/demo/atelie-aurora/${name}.webp`;

export const SHOWCASE_NICHES = {
  doces: {
    banner: nicho("doces", "banner"),
    descricao: "Doces e bolos caseiros feitos sob encomenda, com carinho em cada detalhe.",
    label: "Doces e bolos",
    servico: { entrega_modo: "ambos", entrega_observacao: "Encomendas com 2 dias de antecedência.", formas_pagamento: ["pix", "credito", "dinheiro"], horario_atendimento: "Ter a sáb, das 9h às 19h" },
    tema: "delivery",
    categorias: [
      {
        nome: "Mais pedidos",
        produtos: [
          { descricao: "Brigadeiros gourmet enrolados na hora, em forminhas para presente.", imagem: nicho("doces", "brigadeiros"), nome: "Caixa com 12 brigadeiros", preco: 30, variacao: "Tradicional, ninho ou mista" },
          { descricao: "Brownie de chocolate meio amargo, casquinha crocante e miolo molhadinho.", imagem: nicho("doces", "brownie"), nome: "Brownie recheado", preco: 9, variacao: "Doce de leite ou Nutella" },
          { descricao: "Cookies grandes com gotas de chocolate, assados no dia.", imagem: nicho("doces", "cookies"), nome: "Cookies (pacote com 6)", preco: 22, variacao: null },
        ],
      },
      {
        nome: "Bolos e festas",
        produtos: [
          { descricao: "Bolo decorado para aniversário, com recheio e cobertura à escolha.", imagem: nicho("doces", "bolo-aniversario"), nome: "Bolo de aniversário (2 kg)", preco: 140, variacao: "Serve cerca de 20 pessoas" },
          { descricao: "Fatia generosa de bolo de chocolate com ganache.", imagem: nicho("doces", "fatia-de-bolo"), nome: "Fatia de bolo", preco: 14, variacao: null },
          { descricao: "Cupcake com chantilly e confeitos, ótimo para lembrancinhas.", imagem: nicho("doces", "cupcake"), nome: "Cupcake decorado", preco: 8, variacao: "A partir de 10 unidades" },
        ],
      },
    ],
  },
  artesanato: {
    banner: aurora("banner"),
    descricao: "Peças artesanais e presentes feitos em pequenos lotes.",
    label: "Artesanato e presentes",
    servico: { entrega_modo: "ambos", entrega_observacao: "Enviamos para todo o Brasil.", formas_pagamento: ["pix", "credito"], horario_atendimento: "Seg a sáb, das 9h às 18h" },
    tema: "natural",
    categorias: [
      {
        nome: "Novidades",
        produtos: [
          { descricao: "Caixa kraft com duas velas artesanais e cortador de pavio dourado.", imagem: aurora("kit-afeto"), nome: "Kit Afeto", preco: 84.9, variacao: "Escolha o aroma das velas" },
          { descricao: "Vela de cera vegetal em pote de vidro com tampa.", imagem: aurora("vela-aurora"), nome: "Vela aromática", preco: 42, variacao: "Lavanda, baunilha ou capim-limão" },
          { descricao: "Caneca de cerâmica feita à mão, com acabamento rústico.", imagem: aurora("caneca-orvalho"), nome: "Caneca de cerâmica", preco: 49.9, variacao: "Peças únicas" },
        ],
      },
      {
        nome: "Para presentear",
        produtos: [
          { descricao: "Velas embaladas com flores secas para datas especiais.", imagem: aurora("caixa-celebracao"), nome: "Caixa Celebração", preco: 119.9, variacao: "Cartão com mensagem" },
          { descricao: "Três mini vasos de cerâmica para flores secas.", imagem: aurora("vasos-nuvem"), nome: "Trio de vasos", preco: 79.9, variacao: null },
          { descricao: "Difusor de varetas que perfuma o ambiente por semanas.", imagem: aurora("difusor-brisa"), nome: "Difusor de ambiente", preco: 64.9, variacao: "Alecrim ou flor de laranjeira" },
        ],
      },
    ],
  },
  moda: {
    banner: nicho("moda", "banner"),
    descricao: "Roupas e acessórios selecionados para o seu dia a dia.",
    label: "Moda e acessórios",
    servico: { entrega_modo: "ambos", entrega_observacao: "Entrega no mesmo dia na região.", formas_pagamento: ["pix", "credito", "debito"], horario_atendimento: "Seg a sáb, das 10h às 20h" },
    tema: "minimal",
    categorias: [
      {
        nome: "Roupas",
        produtos: [
          { descricao: "Vestido leve de alcinha, tecido fresquinho com forro.", imagem: nicho("moda", "vestido"), nome: "Vestido Verão", preco: 129.9, variacao: "P, M e G" },
          { descricao: "Camiseta básica 100% algodão, caimento solto.", imagem: nicho("moda", "camiseta"), nome: "Camiseta básica", preco: 49.9, variacao: "Azul, branca ou preta" },
          { descricao: "Sandália de couro com fivela ajustável e palmilha macia.", imagem: nicho("moda", "sandalia"), nome: "Sandália Conforto", preco: 99.9, variacao: "Do 34 ao 39" },
        ],
      },
      {
        nome: "Acessórios",
        produtos: [
          { descricao: "Bolsa transversal de couro sintético com alça regulável.", imagem: nicho("moda", "bolsa"), nome: "Bolsa transversal", preco: 89.9, variacao: "Caramelo ou preta" },
          { descricao: "Argolas folheadas a ouro, leves para usar o dia todo.", imagem: nicho("moda", "argolas"), nome: "Argolas douradas", preco: 39.9, variacao: "Folheado com garantia" },
          { descricao: "Colar com pingente delicado e corrente fina.", imagem: nicho("moda", "colar"), nome: "Colar com pingente", preco: 59.9, variacao: "45 cm" },
        ],
      },
    ],
  },
  marmitas: {
    banner: nicho("marmitas", "banner"),
    descricao: "Comida caseira congelada e saudável, pronta para aquecer.",
    label: "Marmitas e congelados",
    servico: { entrega_modo: "entrega", entrega_observacao: "Entregas às segundas e quintas.", formas_pagamento: ["pix", "dinheiro"], horario_atendimento: "Pedidos até sexta, 18h" },
    tema: "natural",
    categorias: [
      {
        nome: "Kits da semana",
        produtos: [
          { descricao: "Cinco marmitas variadas de 350 g para a semana toda.", imagem: nicho("marmitas", "kit-semanal"), nome: "Kit semanal (5 marmitas)", preco: 99, variacao: "Cardápio muda toda semana" },
          { descricao: "Frango grelhado, arroz integral, legumes e ovo.", imagem: nicho("marmitas", "marmita-fit"), nome: "Marmita fit", preco: 21, variacao: "350 g" },
          { descricao: "Frango assado com arroz amarelo e salada.", imagem: nicho("marmitas", "frango-com-arroz"), nome: "Frango com arroz", preco: 19, variacao: "400 g" },
        ],
      },
      {
        nome: "Pratos e sopas",
        produtos: [
          { descricao: "Lasanha à bolonhesa com bastante queijo, porção individual.", imagem: nicho("marmitas", "lasanha"), nome: "Lasanha à bolonhesa", preco: 24, variacao: "450 g" },
          { descricao: "Salada completa com grãos, frango e molho à parte.", imagem: nicho("marmitas", "salada"), nome: "Salada completa", preco: 22, variacao: null },
          { descricao: "Sopa cremosa de abóbora com gengibre, congelada em pote.", imagem: nicho("marmitas", "sopa"), nome: "Creme de abóbora", preco: 18, variacao: "500 ml" },
        ],
      },
    ],
  },
  cosmeticos: {
    banner: nicho("cosmeticos", "banner"),
    descricao: "Maquiagem, perfumes e cuidados com a pele com pronta entrega.",
    label: "Cosméticos e perfumes",
    servico: { entrega_modo: "ambos", entrega_observacao: "Retirada combinada pelo WhatsApp.", formas_pagamento: ["pix", "credito"], horario_atendimento: "Seg a sex, das 9h às 18h" },
    tema: "elegante",
    categorias: [
      {
        nome: "Maquiagem",
        produtos: [
          { descricao: "Batom cremoso de longa duração, acabamento acetinado.", imagem: nicho("cosmeticos", "batom"), nome: "Batom cremoso", preco: 34.9, variacao: "Nude, rosa ou vermelho" },
          { descricao: "Paleta com quatro sombras de alta pigmentação.", imagem: nicho("cosmeticos", "paleta"), nome: "Paleta de sombras", preco: 59.9, variacao: null },
          { descricao: "Perfume floral amadeirado, frasco de bolso.", imagem: nicho("cosmeticos", "perfume"), nome: "Perfume floral 30 ml", preco: 89.9, variacao: null },
        ],
      },
      {
        nome: "Cuidados com a pele",
        produtos: [
          { descricao: "Sérum facial com vitamina C para uma pele mais uniforme.", imagem: nicho("cosmeticos", "serum"), nome: "Sérum vitamina C", preco: 69.9, variacao: "30 ml" },
          { descricao: "Creme hidratante facial de textura leve.", imagem: nicho("cosmeticos", "hidratante"), nome: "Creme hidratante", preco: 49.9, variacao: "50 g" },
          { descricao: "Sabonete artesanal vegetal, embalado para presente.", imagem: nicho("cosmeticos", "sabonete"), nome: "Sabonete artesanal", preco: 16.9, variacao: "Erva-doce ou lavanda" },
        ],
      },
    ],
  },
} as const satisfies Record<string, ShowcaseNicheTemplate>;

export type ShowcaseNiche = keyof typeof SHOWCASE_NICHES;

export const SHOWCASE_NICHE_IDS = Object.keys(SHOWCASE_NICHES) as ShowcaseNiche[];

export type ShowcaseParams = {
  nicho: ShowcaseNiche;
  nome: string;
  tema: TenantTheme;
};

const MAX_NAME_LENGTH = 60;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Lê ?nome=&nicho=&tema= da URL. Sem nome válido, devolve null (mostra o formulário). */
export function parseShowcaseParams(params: Record<string, string | string[] | undefined>): ShowcaseParams | null {
  const nome = (first(params.nome) ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
  if (nome.length < 2) return null;
  const rawNiche = first(params.nicho);
  const nicho: ShowcaseNiche = rawNiche && Object.hasOwn(SHOWCASE_NICHES, rawNiche) ? rawNiche as ShowcaseNiche : "doces";
  const rawTheme = first(params.tema);
  const tema = THEMES.find((theme) => theme.id === rawTheme)?.id ?? SHOWCASE_NICHES[nicho].tema;
  return { nicho, nome, tema };
}

export function showcaseHref({ nicho, nome, tema }: ShowcaseParams) {
  return `/exemplo?${new URLSearchParams({ nome, nicho, tema })}`;
}

/** Cadastro já preenchido com o nome e o tema escolhidos na prévia. */
export function showcaseSignupHref({ nome, tema }: ShowcaseParams) {
  return `/cadastro?${new URLSearchParams({ nome, tema })}`;
}

export function buildShowcaseCatalog({ nicho, nome, tema }: ShowcaseParams): PublicCatalog {
  const template = SHOWCASE_NICHES[nicho];
  let productIndex = 0;
  return {
    ...template.servico,
    formas_pagamento: [...template.servico.formas_pagamento],
    banner_url: template.banner,
    categorias: template.categorias.map((category, categoryIndex) => ({
      id: `00000000-0000-4000-8000-${String(900 + categoryIndex).padStart(12, "0")}`,
      nome: category.nome,
      ordem: categoryIndex,
      produtos: category.produtos.map((product, ordem) => ({
        descricao: product.descricao,
        id: `00000000-0000-4000-8000-${String(1000 + productIndex++).padStart(12, "0")}`,
        imagem_url: product.imagem,
        nome: product.nome,
        ordem,
        preco: product.preco,
        variacao_info: product.variacao,
      })),
    })),
    descricao_curta: template.descricao,
    endereco: null,
    instagram: null,
    logo_url: null,
    nome_loja: nome,
    slug: "exemplo",
    status: "ativo",
    tema,
    // Número fictício: na prévia nenhum botão abre o WhatsApp.
    whatsapp: "5500000000000",
  };
}
