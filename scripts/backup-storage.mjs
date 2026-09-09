import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (nodeMajor < 22) {
  console.error(`O backup exige Node.js 22 ou superior (versão atual: ${process.versions.node}).`);
  process.exit(1);
}

const outputFlagIndex = process.argv.indexOf("--output");
const outputValue = outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

if (!outputValue) {
  console.error("Informe uma pasta privada fora do repositório com --output CAMINHO.");
  process.exit(1);
}

const repositoryRoot = path.resolve(process.cwd());
const outputRoot = path.resolve(outputValue);
const relativeToRepository = path.relative(repositoryRoot, outputRoot);
const outputIsInsideRepository = relativeToRepository === ""
  || (!relativeToRepository.startsWith("..") && !path.isAbsolute(relativeToRepository));

if (outputIsInsideRepository) {
  console.error("Por segurança, escolha uma pasta de backup fora do repositório ClickCatálogo.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: tenants, error: tenantsError } = await supabase
  .from("tenants")
  .select("id")
  .order("id");

if (tenantsError) {
  console.error(`Não foi possível listar as lojas: ${tenantsError.message}`);
  process.exit(1);
}

const backupDirectory = path.join(
  outputRoot,
  new Date().toISOString().replaceAll(":", "-").replace(".", "-"),
);
await mkdir(backupDirectory, { recursive: true });

const files = [];
const pendingPrefixes = [""];

while (pendingPrefixes.length > 0) {
  const prefix = pendingPrefixes.shift();
  let offset = 0;

  while (true) {
    const { data: objects, error: listError } = await supabase.storage
      .from("produtos")
      .list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      console.error(`Não foi possível listar o Storage em ${prefix || "raiz"}: ${listError.message}`);
      process.exit(1);
    }

    if (!objects?.length) break;

    for (const object of objects) {
      const storagePath = prefix ? `${prefix}/${object.name}` : object.name;
      if (!object.id) {
        if (object.name && object.name !== ".emptyFolderPlaceholder") pendingPrefixes.push(storagePath);
        continue;
      }

      const pathParts = storagePath.split("/");
      if (pathParts.some((part) => !part || part === "." || part === ".." || path.basename(part) !== part)) {
        console.error(`O objeto possui um caminho inseguro e não será gravado: ${storagePath}`);
        process.exit(1);
      }

      const { data, error: downloadError } = await supabase.storage
        .from("produtos")
        .download(storagePath);

      if (downloadError || !data) {
        console.error(`Não foi possível baixar ${storagePath}: ${downloadError?.message ?? "arquivo vazio"}`);
        process.exit(1);
      }

      const destination = path.resolve(backupDirectory, ...pathParts);
      if (!destination.startsWith(`${backupDirectory}${path.sep}`)) {
        console.error(`O objeto aponta para fora da pasta de backup: ${storagePath}`);
        process.exit(1);
      }
      const fileBuffer = Buffer.from(await data.arrayBuffer());
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, fileBuffer);
      files.push({
        path: storagePath,
        sha256: createHash("sha256").update(fileBuffer).digest("hex"),
        size: object.metadata?.size ?? data.size,
      });
    }

    if (objects.length < 1000) break;
    offset += objects.length;
  }
}

const manifest = {
  bucket: "produtos",
  files,
  generatedAt: new Date().toISOString(),
  tenants: tenants?.length ?? 0,
};

await writeFile(
  path.join(backupDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({ directory: backupDirectory, files: files.length, tenants: manifest.tenants }, null, 2));
