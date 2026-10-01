import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Reconstrói a loja de demonstração Ateliê Aurora com fotos reais (Pexels,
// licença livre; créditos em planejamento-justo-tecnologias/.../CREDITOS.md).
// Simula por padrão. A troca exige --apply --replace e gera backup local.
// Mantém slug, proprietário, WhatsApp, tema e assinatura da loja.

const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
const TENANT_SLUG = "atelie-aurora";
const STORAGE_PREFIX = "atelie-aurora-demo";
const IMAGE_DIRECTORY = path.resolve(
  process.cwd(),
  "..",
  "planejamento-justo-tecnologias",
  "social-media",
  "demo",
  "atelie-aurora",
);

const STORE = {
  descricaoCurta: "Velas, cerâmicas e presentes artesanais feitos em pequenos lotes para transformar pequenos momentos.",
};

const categories = ["Novidades", "Velas e aromas", "Casa e afeto", "Para presentear"];
const products = [
  { category: "Novidades", image: "kit-afeto.jpg", name: "Kit Afeto", price: 84.9, description: "Caixa kraft com duas velas artesanais e cortador de pavio dourado.", variation: "Escolha o aroma das velas" },
  { category: "Novidades", image: "vela-aurora.jpg", name: "Vela Aurora", price: 42, description: "Vela de cera vegetal em pote de vidro com tampa, produzida em pequenos lotes.", variation: "Lavanda, baunilha ou capim-limão" },
  { category: "Novidades", image: "caneca-orvalho.jpg", name: "Caneca Orvalho", price: 49.9, description: "Caneca de cerâmica feita à mão, com esmalte verde e acabamento rústico.", variation: "Peças únicas, com pequenas variações de cor" },
  { category: "Velas e aromas", image: "vela-jardim.jpg", name: "Vela Jardim", price: 38, description: "Aroma floral delicado em pote de vidro reutilizável.", variation: "180 g" },
  { category: "Velas e aromas", image: "vela-aconchego.jpg", name: "Vela Aconchego", price: 46, description: "Notas quentes de baunilha e madeira em pote âmbar.", variation: "220 g" },
  { category: "Velas e aromas", image: "difusor-brisa.jpg", name: "Difusor Brisa", price: 64.9, description: "Difusor de varetas em frasco âmbar que perfuma o ambiente por semanas.", variation: "Alecrim, flor de laranjeira ou bambu" },
  { category: "Casa e afeto", image: "xicaras-areia.jpg", name: "Conjunto Xícaras Areia", price: 89.9, description: "Xícaras de cerâmica artesanal em tom areia, modeladas à mão.", variation: "Conjunto com 4 peças" },
  { category: "Casa e afeto", image: "bolsa-essencial.jpg", name: "Bolsa Essencial", price: 69.9, description: "Ecobag de algodão cru, leve e resistente para a rotina.", variation: "40 × 35 cm" },
  { category: "Casa e afeto", image: "vasos-nuvem.jpg", name: "Trio de Vasos Nuvem", price: 79.9, description: "Três mini vasos de cerâmica branca para flores secas.", variation: "Flores secas não inclusas" },
  { category: "Para presentear", image: "caixa-celebracao.jpg", name: "Caixa Celebração", price: 119.9, description: "Velas artesanais embaladas com flores secas para aniversários e datas especiais.", variation: "Cartão com mensagem personalizada" },
  { category: "Para presentear", image: "pequenos-momentos.jpg", name: "Presente Pequenos Momentos", price: 59.9, description: "Vela aromática em caixa kraft com laço de cetim.", variation: "Laço vermelho ou rosé" },
  { category: "Para presentear", image: "kit-aconchegante.png", name: "Kit Casa Aconchegante", price: 139.9, description: "Caneca de cerâmica e vela aromática para pausas tranquilas em casa.", variation: "Embalagem para presente" },
];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} antes de executar a importação.`);
  return value;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Produtos: quadrado 1:1 (como o card da loja); banner: 21:9; logo: 512 px.
// WebP com qualidade alta, sempre abaixo do limite de 2 MB do bucket.
async function prepareImages() {
  const prepared = new Map();
  for (const product of products) {
    const buffer = await sharp(path.join(IMAGE_DIRECTORY, product.image))
      .rotate()
      .resize(1200, 1200, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    prepared.set(product.image, buffer);
  }
  prepared.set("banner", await sharp(path.join(IMAGE_DIRECTORY, "banner.jpg"))
    .rotate()
    .resize(2100, 900, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer());
  prepared.set("logo", await sharp(path.join(IMAGE_DIRECTORY, "logo.svg"), { density: 144 })
    .resize(512, 512)
    .webp({ quality: 90 })
    .toBuffer());

  for (const [name, buffer] of prepared) {
    if (buffer.byteLength > 2 * 1024 * 1024) throw new Error(`Imagem ${name} excede 2 MB.`);
  }
  return prepared;
}

function storageName(image) {
  return `${image.replace(/\.(jpe?g|png|svg)$/i, "")}.webp`;
}

async function main() {
  const images = await prepareImages();
  const totalKb = Math.round([...images.values()].reduce((sum, buffer) => sum + buffer.byteLength, 0) / 1024);
  console.log(`Imagens preparadas: ${images.size} arquivos WebP, ${totalKb} KB no total.`);

  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id,nome_loja,slug,status,tema,descricao_curta,logo_url,banner_url")
    .eq("slug", TENANT_SLUG)
    .single();
  if (tenantError) throw new Error(`Loja ${TENANT_SLUG}: ${tenantError.message}`);

  const [{ data: currentCategories, error: categoryError }, { data: currentProducts, error: productError }] = await Promise.all([
    supabase.from("categories").select("*").eq("tenant_id", tenant.id).order("ordem"),
    supabase.from("products").select("*").eq("tenant_id", tenant.id).order("ordem"),
  ]);
  if (categoryError) throw new Error(`Categorias atuais: ${categoryError.message}`);
  if (productError) throw new Error(`Produtos atuais: ${productError.message}`);

  console.log(`${tenant.nome_loja} (${tenant.slug}) · status ${tenant.status} · tema ${tenant.tema}`);
  console.log(`Catálogo atual: ${currentCategories.length} categorias e ${currentProducts.length} produtos.`);
  console.log(`Novo catálogo: ${categories.length} categorias e ${products.length} produtos com fotos reais.`);
  console.log(`Logo e banner atuais: ${tenant.logo_url ?? "—"} | ${tenant.banner_url ?? "—"}`);

  if (!APPLY) {
    console.log("Simulação concluída. Nenhum dado foi alterado.");
    console.log("Para aplicar: npm run import:atelie-aurora -- --apply --replace");
    return;
  }
  if (!REPLACE) throw new Error("Para substituir o catálogo atual, confirme também a opção --replace.");

  const backupDirectory = path.resolve(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `atelie-aurora-before-import-${timestamp()}.json`);
  await writeFile(backupPath, `${JSON.stringify({ tenant, categories: currentCategories, products: currentProducts }, null, 2)}\n`, "utf8");
  console.log(`Backup local: ${backupPath}`);

  const urls = new Map();
  for (const [name, buffer] of images) {
    const file = name === "banner" || name === "logo" ? `${name}.webp` : storageName(name);
    const storagePath = `${tenant.id}/${STORAGE_PREFIX}/${file}`;
    const { error } = await supabase.storage.from("produtos").upload(storagePath, buffer, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw new Error(`Upload ${file}: ${error.message}`);
    // O parâmetro de versão evita que a CDN sirva uma imagem antiga após reimportar.
    urls.set(name, `${supabase.storage.from("produtos").getPublicUrl(storagePath).data.publicUrl}?v=${Date.now()}`);
  }

  const { data: insertedCategories, error: insertCategoriesError } = await supabase
    .from("categories")
    .insert(categories.map((nome, ordem) => ({ nome: `${nome} (nova)`, ordem: ordem + 100, tenant_id: tenant.id })))
    .select("id,nome");
  if (insertCategoriesError) throw new Error(`Novas categorias: ${insertCategoriesError.message}`);
  const categoryIds = new Map(insertedCategories.map((category) => [category.nome.replace(/ \(nova\)$/, ""), category.id]));

  const { error: insertProductsError } = await supabase
    .from("products")
    .insert(products.map((product, ordem) => ({
      ativo: true,
      category_id: categoryIds.get(product.category),
      descricao: product.description,
      imagem_url: urls.get(product.image),
      nome: product.name,
      ordem,
      preco: product.price,
      tenant_id: tenant.id,
      variacao_info: product.variation,
    })));
  if (insertProductsError) {
    await supabase.from("categories").delete().in("id", insertedCategories.map((category) => category.id));
    throw new Error(`Novos produtos: ${insertProductsError.message}`);
  }

  if (currentProducts.length > 0) {
    const { error } = await supabase.from("products").delete().in("id", currentProducts.map((product) => product.id));
    if (error) throw new Error(`Remoção dos produtos anteriores: ${error.message}`);
  }
  if (currentCategories.length > 0) {
    const { error } = await supabase.from("categories").delete().in("id", currentCategories.map((category) => category.id));
    if (error) throw new Error(`Remoção das categorias anteriores: ${error.message}`);
  }
  // Nomes temporários evitam colisão com o índice único de nome por loja.
  for (const [ordem, nome] of categories.entries()) {
    const { error } = await supabase
      .from("categories")
      .update({ nome, ordem })
      .eq("id", categoryIds.get(nome));
    if (error) throw new Error(`Ordenação final de ${nome}: ${error.message}`);
  }

  const { error: tenantUpdateError } = await supabase
    .from("tenants")
    .update({ banner_url: urls.get("banner"), descricao_curta: STORE.descricaoCurta, logo_url: urls.get("logo") })
    .eq("id", tenant.id);
  if (tenantUpdateError) throw new Error(`Identidade da loja: ${tenantUpdateError.message}`);

  console.log(`Importação concluída: ${products.length} produtos, logo e banner publicados.`);
  console.log(`A loja pública atualiza em até 60 segundos: /loja/${TENANT_SLUG}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
