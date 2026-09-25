import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
const TENANT_SLUG = "justo-shop";
const IMAGE_DIRECTORY = path.resolve(
  process.cwd(),
  "..",
  "planejamento-justo-tecnologias",
  "social-media",
  "afiliados",
  "imagens",
);

const TRACKING = "source=lists&type=product&tracking_id=5e85a492-0347-4264-a6a8-e331dc5f4180&sid=storefronts";
const categories = ["Casa e cozinha", "Organização", "Auto e ferramentas", "Viagem"];
const products = [
  {
    category: "Casa e cozinha",
    description: "Fritadeira sem óleo com 11 litros, janela transparente, 1800 W e 8 funções. Modelo PAF11B, preto, 127 V.",
    image: "produto-01-hd.webp",
    link: `https://www.mercadolivre.com.br/fritadeira-air-fryer-oven-11-litros-1800w-8-funcoes-philco-paf11b/p/MLB56550237?${TRACKING}&wid=MLB4856696863`,
    name: "Air Fryer Oven Philco 11 L",
    price: 353.13,
  },
  {
    category: "Casa e cozinha",
    description: "Resistência 3065-B para duchas Lorenzetti Acqua Ultra, 220 V e 7800 W. Confira modelo, voltagem e potência antes da compra.",
    image: "produto-02-hd.webp",
    link: `https://www.mercadolivre.com.br/resistencia-lorenzetti-ducha-acqua-ultra-3065-b-220v-7800w/p/MLB27506357?${TRACKING}&wid=MLB5040048777`,
    name: "Resistência Lorenzetti Acqua Ultra",
    price: 72,
  },
  {
    category: "Auto e ferramentas",
    description: "Mini compressor digital portátil com calibrador para pneus de carro, bicicleta e motocicleta.",
    image: "produto-04-hd.webp",
    link: `https://www.mercadolivre.com.br/mini-compressor-digital-rezzet-bomba-de-encher-pneus-portatil-para-carro-bicicleta-motocicletas-cor-preto-com-calibrador/p/MLB27821077?${TRACKING}&wid=MLB5133915699`,
    name: "Mini compressor digital Rezzet",
    price: 78,
  },
  {
    category: "Casa e cozinha",
    description: "Maçarico culinário regulável para finalizar pratos e sobremesas. Acompanha quatro cartuchos de gás butano NTK.",
    image: "produto-05-hd.webp",
    link: `https://www.mercadolivre.com.br/kit-macarico-culinario-profissional-starfer-4-refil-gas-ntk/p/MLB24795178?${TRACKING}&wid=MLB4510218313`,
    name: "Kit maçarico culinário Starfer",
    price: 59.9,
  },
  {
    category: "Organização",
    description: "Dois travesseiros 70 x 50 cm, antialérgicos, laváveis e preenchidos com fibra siliconada com toque de pluma.",
    image: "produto-06-hd.webp",
    link: `https://www.mercadolivre.com.br/kit-2-travesseiros-70x50-antialergico-lavavel-fibra-siliconada-toque-de-pluma-de-ganso-oaktex-cor-branco/p/MLB43954645?${TRACKING}&wid=MLB5197670602`,
    name: "Kit 2 travesseiros Oaktex",
    price: 34.99,
  },
  {
    category: "Auto e ferramentas",
    description: "Carregador inteligente 12 V e 6 A para baterias de 4 Ah a 100 Ah, com display digital e proteções automáticas.",
    image: "produto-07-hd.webp",
    link: `https://www.mercadolivre.com.br/carregador-de-bateria-inteligente-davely-6a-bivolt-para-carro-moto-caminhao-jet-ski-e-barco-display-digital-recupera-bateria-carga-rapida-e-eficiente-cabo-reforcado-reparo-por-pulso/p/MLB62564330?${TRACKING}&wid=MLB6537511062`,
    name: "Carregador de bateria Davely 6 A",
    price: 49.9,
  },
  {
    category: "Viagem",
    description: "Balança digital portátil para malas de até 50 kg, com visor LCD e alça para malas e sacolas.",
    image: "produto-08-hd.webp",
    link: `https://www.mercadolivre.com.br/balanca-hardline-para-malas-de-viagem-digital-portatil-ate-50kg/p/MLB60100356?${TRACKING}&wid=MLB6787114898`,
    name: "Balança digital para malas Hardline",
    price: 25.99,
  },
  {
    category: "Auto e ferramentas",
    description: "Talha manual para até 1 tonelada, com corrente de 2 metros e freio reforçado. Indicada para uso profissional.",
    image: "produto-09-hd.webp",
    link: `https://www.mercadolivre.com.br/talha-manual-1-tonelada-1000kg-corrente-2-metros-de-elevacao-com-freio-reforcado-8x-tech/p/MLB64834508?${TRACKING}&wid=MLB4437371193`,
    name: "Talha manual 1 tonelada 8X Tech",
    price: 199.9,
  },
  {
    category: "Auto e ferramentas",
    description: "Lavadora portátil recarregável com duas baterias, mangueira, dispenser de sabão e maleta. Necessita de alimentação de água.",
    image: "produto-10-hd.webp",
    link: `https://www.mercadolivre.com.br/lavadora-lava-jato-portatil-pressao-2-baterias--maleta/up/MLBU605239077?pdp_filters=item_id%3AMLB3621404839&${TRACKING}&wid=MLB3621404839`,
    name: "Lavadora portátil MyMotors",
    price: 101.7,
  },
  {
    category: "Organização",
    description: "Organizador com espaço para 12 pares de calçados e 8 ganchos para casacos, bolsas e acessórios.",
    image: "produto-11-hd.webp",
    link: `https://www.mercadolivre.com.br/sapateira-organizador-porta-sapatos-12-pares-hw-com-8-ganchos-cor-preto/p/MLB23748762?pdp_filters=item_id%3AMLB4543216569&${TRACKING}&wid=MLB4543216569`,
    name: "Sapateira organizadora para 12 pares",
    price: 41.9,
  },
  {
    category: "Casa e cozinha",
    description: "Câmera de segurança Wi-Fi em formato de lâmpada, Full HD, com visão noturna, áudio bidirecional e soquete E27.",
    image: "produto-12-hd.webp",
    link: `https://www.mercadolivre.com.br/camera-seguranca-lampada-wifi-360-full-hd-1080p-visao-noturna-infravermelho-audio-bidirecional-soquete-e27-app-yoosee-24ghz-rotacao-360x90-monitoramento-residencial/p/MLB55051145?${TRACKING}&wid=MLB4971723797`,
    name: "Câmera lâmpada Wi-Fi 360°",
    price: 56.3,
  },
];

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Configure ${name} antes de executar o importador.`);
  return value;
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function main() {
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id,nome_loja,slug")
    .eq("slug", TENANT_SLUG)
    .single();
  if (tenantError) throw new Error(`Loja ${TENANT_SLUG}: ${tenantError.message}`);

  const [{ data: currentCategories, error: categoryError }, { data: currentProducts, error: productError }] = await Promise.all([
    supabase.from("categories").select("*").eq("tenant_id", tenant.id).order("ordem"),
    supabase.from("products").select("*").eq("tenant_id", tenant.id).order("ordem"),
  ]);
  if (categoryError) throw new Error(`Categorias atuais: ${categoryError.message}`);
  if (productError) throw new Error(`Produtos atuais: ${productError.message}`);

  console.log(`${tenant.nome_loja} (${tenant.slug})`);
  console.log(`Catálogo atual: ${currentCategories.length} categorias e ${currentProducts.length} produtos.`);
  console.log(`Novo catálogo: ${categories.length} categorias e ${products.length} produtos.`);

  if (!APPLY) {
    console.log("Simulação concluída. Nenhum dado foi alterado.");
    console.log("Após executar a migration 022, use: npm run import:justo-shop -- --apply --replace");
    return;
  }
  if (!REPLACE) throw new Error("Para substituir o catálogo atual, confirme também a opção --replace.");

  const { error: migrationError } = await supabase.from("products").select("link_externo").limit(1);
  if (migrationError) {
    throw new Error(`Execute primeiro a migration 202609250022_product_external_links.sql: ${migrationError.message}`);
  }

  const backupDirectory = path.resolve(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `justo-shop-before-import-${timestamp()}.json`);
  await writeFile(backupPath, `${JSON.stringify({ tenant, categories: currentCategories, products: currentProducts }, null, 2)}\n`, "utf8");
  console.log(`Backup local: ${backupPath}`);

  const imageUrls = new Map();
  for (const product of products) {
    const imagePath = path.join(IMAGE_DIRECTORY, product.image);
    const file = await readFile(imagePath);
    const storagePath = `${tenant.id}/justo-shop-afiliados/${product.image}`;
    const { error } = await supabase.storage.from("produtos").upload(storagePath, file, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw new Error(`Upload ${product.image}: ${error.message}`);
    imageUrls.set(product.image, supabase.storage.from("produtos").getPublicUrl(storagePath).data.publicUrl);
  }

  const { data: insertedCategories, error: insertCategoriesError } = await supabase
    .from("categories")
    .insert(categories.map((nome, ordem) => ({ nome, ordem: ordem + 100, tenant_id: tenant.id })))
    .select("id,nome");
  if (insertCategoriesError) throw new Error(`Novas categorias: ${insertCategoriesError.message}`);
  const categoryIds = new Map(insertedCategories.map((category) => [category.nome, category.id]));

  const { data: insertedProducts, error: insertProductsError } = await supabase
    .from("products")
    .insert(products.map((product, ordem) => ({
      ativo: true,
      category_id: categoryIds.get(product.category),
      descricao: product.description,
      imagem_url: imageUrls.get(product.image),
      link_externo: product.link,
      nome: product.name,
      ordem,
      preco: product.price,
      tenant_id: tenant.id,
      variacao_info: "Publicidade · link de afiliado",
    })))
    .select("id");
  if (insertProductsError) {
    await supabase.from("categories").delete().in("id", insertedCategories.map((category) => category.id));
    throw new Error(`Novos produtos: ${insertProductsError.message}`);
  }

  const newProductIds = new Set(insertedProducts.map((product) => product.id));
  const oldProductIds = currentProducts.filter((product) => !newProductIds.has(product.id)).map((product) => product.id);
  if (oldProductIds.length > 0) {
    const { error } = await supabase.from("products").delete().in("id", oldProductIds);
    if (error) throw new Error(`Remoção dos produtos anteriores: ${error.message}`);
  }
  if (currentCategories.length > 0) {
    const { error } = await supabase.from("categories").delete().in("id", currentCategories.map((category) => category.id));
    if (error) throw new Error(`Remoção das categorias anteriores: ${error.message}`);
  }
  const { error: reorderError } = await supabase
    .from("categories")
    .upsert(insertedCategories.map((category, ordem) => ({ id: category.id, nome: category.nome, ordem, tenant_id: tenant.id })));
  if (reorderError) throw new Error(`Ordenação final: ${reorderError.message}`);

  console.log(`Importação concluída: ${products.length} produtos publicados com imagens HD e links externos.`);
  console.log("Os dois itens com título e descrição contraditórios não foram publicados.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
