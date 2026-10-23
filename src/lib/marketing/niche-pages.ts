import type { ShowcaseNiche } from "@/lib/marketing/store-showcase";

// Páginas por nicho para busca orgânica (/para/[nicho]). Cada uma fala a dor
// daquele público e leva à prévia já no nicho certo. Sem depoimentos nem
// números inventados: só o que o produto faz hoje.

type Faq = { answer: string; question: string };

export type NichePage = {
  description: string;
  heading: string;
  intro: string;
  pains: string[];
  solutions: string[];
  faq: Faq[];
  title: string;
};

const COMMON_FAQ: Faq[] = [
  {
    answer: "Montar a loja é grátis. Para publicar, o plano custa R$ 27/mês no cartão, sem comissão sobre as vendas e sem fidelidade: você cancela quando quiser.",
    question: "Quanto custa?",
  },
  {
    answer: "Não. A sua loja é um link (clickcatalogo.com/loja/seu-nome) que você coloca na bio do Instagram e manda no WhatsApp. O cliente abre no celular, sem instalar nada.",
    question: "Preciso de site ou aplicativo?",
  },
  {
    answer: "Pelo WhatsApp, do jeito que você já faz: Pix, cartão na maquininha ou dinheiro. O ClickCatálogo organiza o pedido; pagamento e entrega você combina direto com o cliente.",
    question: "Como recebo o pagamento?",
  },
];

export const NICHE_PAGES: Record<ShowcaseNiche, NichePage> = {
  doces: {
    description: "Monte o catálogo da sua confeitaria em minutos: brigadeiros, bolos e kits festa num link, com pedido somado no WhatsApp. Grátis para montar.",
    faq: [
      {
        answer: "Sim. Escreva o prazo no atendimento da loja (por exemplo, \"encomendas com 2 dias de antecedência\") e o cliente vê antes de pedir. O pedido chega no seu WhatsApp e você confirma a data com ele.",
        question: "Dá para trabalhar só com encomenda?",
      },
      {
        answer: "Cada produto tem um campo de variação, como \"tradicional, ninho ou mista\" ou \"serve 20 pessoas\". O cliente escreve a escolha na observação do pedido.",
        question: "Como mostro sabores e tamanhos?",
      },
      ...COMMON_FAQ,
    ],
    heading: "Catálogo digital para doces e bolos",
    intro: "Brigadeiros, bolos e kits festa num link só. O cliente escolhe sabores e quantidades sozinho, e o pedido chega somado no seu WhatsApp.",
    pains: [
      "Responder \"quanto custa o cento?\" o dia inteiro.",
      "Mandar de novo a foto de cada bolo para cada cliente.",
      "Somar pedido de festa na calculadora e ainda errar o total.",
    ],
    solutions: [
      "Organize por categoria: docinhos, bolos, kits para festa.",
      "Mostre sabores, tamanhos e rendimento em cada produto.",
      "Deixe prazo de encomenda, entrega ou retirada à vista no catálogo.",
    ],
    title: "Catálogo digital para doces e bolos",
  },
  artesanato: {
    description: "Catálogo digital para artesanato e presentes: suas peças com foto, medidas e preço num link, e o pedido organizado no WhatsApp. Grátis para montar.",
    faq: [
      {
        answer: "Sim. Informe no atendimento da loja que você envia para todo o Brasil; frete e prazo você combina com o cliente pelo WhatsApp, junto com o pedido.",
        question: "Vendo para outras cidades. Funciona?",
      },
      {
        answer: "Sim. Oculte a peça com um toque quando esgotar e volte a mostrar quando tiver de novo. O link da loja continua o mesmo.",
        question: "E quando uma peça esgota?",
      },
      ...COMMON_FAQ,
    ],
    heading: "Catálogo digital para artesanato e presentes",
    intro: "Velas, cerâmicas, crochê, sabonetes, presentes: cada peça com foto, medidas e preço num link. O cliente escolhe e o pedido chega organizado no seu WhatsApp.",
    pains: [
      "Peça única que esgota e você precisa avisar cliente por cliente.",
      "\"Manda mais fotos?\" para cada item que a pessoa vê no feed.",
      "Pedido personalizado (cor, nome, data) perdido no meio das conversas.",
    ],
    solutions: [
      "Oculte o que esgotou e mostre de novo quando produzir mais.",
      "Descrição e medidas em cada peça, para o cliente decidir sozinho.",
      "O pedido chega com os itens, o total e a observação do cliente.",
    ],
    title: "Catálogo digital para artesanato e presentes",
  },
  moda: {
    description: "Catálogo digital para lojas de roupas, semijoias e acessórios: peças com tamanhos, cores e preço num link, e pedido pronto no WhatsApp. Grátis para montar.",
    faq: [
      {
        answer: "Sim. Funciona para quem produz e para quem revende roupas, semijoias, bolsas e acessórios. Use fotos próprias ou que você tenha autorização para usar.",
        question: "Serve para revenda?",
      },
      {
        answer: "Os tamanhos e as cores ficam no campo de variação de cada peça (por exemplo, \"P, M e G\" ou \"preta ou caramelo\"). O cliente escreve a escolha na observação do pedido.",
        question: "Como o cliente escolhe tamanho e cor?",
      },
      ...COMMON_FAQ,
    ],
    heading: "Catálogo digital para moda e acessórios",
    intro: "Roupas, calçados, semijoias e bolsas num link sempre atualizado. A cliente vê tamanhos, cores e preços, monta o pedido e manda pronto no seu WhatsApp.",
    pains: [
      "\"Tem no M?\", \"tem em azul?\" o dia inteiro.",
      "Catálogo em PDF que fica desatualizado toda semana.",
      "Cliente que some no meio da conversa sem fechar o pedido.",
    ],
    solutions: [
      "Tamanhos e cores informados em cada peça.",
      "Atualize preço e estoque na hora: o link é sempre o mesmo.",
      "A cliente escolhe sozinha e manda o pedido somado, sem idas e vindas.",
    ],
    title: "Catálogo digital para moda e acessórios",
  },
  marmitas: {
    description: "Catálogo digital para marmitas e congelados: cardápio, kits e dias de entrega num link, com pedido somado no WhatsApp. Grátis para montar.",
    faq: [
      {
        answer: "Sim. Oculte os pratos que saíram e publique os novos; o link do cardápio continua o mesmo, então o cliente sempre vê a versão atual.",
        question: "Consigo mudar o cardápio toda semana?",
      },
      {
        answer: "No atendimento da loja você informa os dias de entrega, se faz retirada e as formas de pagamento. Tudo aparece no catálogo e no carrinho.",
        question: "Onde informo os dias de entrega?",
      },
      ...COMMON_FAQ,
    ],
    heading: "Catálogo digital para marmitas e congelados",
    intro: "Kits da semana, pratos e sopas num cardápio que o cliente abre no celular. Ele monta o pedido e você recebe tudo somado no WhatsApp, pronto para separar.",
    pains: [
      "Mandar o cardápio da semana em foto toda segunda-feira.",
      "Anotar no papel os pedidos de vários clientes ao mesmo tempo.",
      "Errar a conta do kit com vários pratos.",
    ],
    solutions: [
      "Cardápio por categoria (kits, pratos, sopas) sempre no mesmo link.",
      "Dias de entrega e formas de pagamento à vista no catálogo.",
      "Pedido com itens, quantidades e total: você só confirma a entrega.",
    ],
    title: "Catálogo digital para marmitas e congelados",
  },
  cosmeticos: {
    description: "Catálogo digital para cosméticos e perfumes: produtos de pronta entrega com preço e tamanho num link, e pedido somado no WhatsApp. Grátis para montar.",
    faq: [
      {
        answer: "Sim. Cadastre os produtos que você tem para vender, com seus preços. Use fotos próprias ou que você tenha autorização para usar.",
        question: "Serve para revendedora?",
      },
      {
        answer: "Use a variação de cada produto para fragrância, cor ou tamanho (ml, g). Assim a cliente sabe exatamente o que está pedindo.",
        question: "Como mostro tamanhos e fragrâncias?",
      },
      ...COMMON_FAQ,
    ],
    heading: "Catálogo digital para cosméticos e perfumes",
    intro: "Maquiagem, perfumes e cuidados com a pele que você tem para pronta entrega, num link com preço e foto. A cliente escolhe e o pedido chega somado no seu WhatsApp.",
    pains: [
      "A revista da marca não mostra o que você tem em pronta entrega.",
      "Cliente perguntando o preço de item por item.",
      "Pedidos de várias clientes misturados na mesma conversa.",
    ],
    solutions: [
      "Mostre só o que você tem, organizado por categoria.",
      "Preço, tamanho e fragrância em cada produto.",
      "Cada pedido chega separado, com os itens e o total.",
    ],
    title: "Catálogo digital para cosméticos e perfumes",
  },
};
