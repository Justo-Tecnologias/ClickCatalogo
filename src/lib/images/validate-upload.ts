import "server-only";

import sharp from "sharp";

export const MAX_CATALOG_IMAGE_BYTES = 2 * 1024 * 1024;
export const CATALOG_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CATALOG_IMAGE_PIXELS = 20_000_000;
const MAX_CATALOG_IMAGE_EDGE = 8_000;
const IMAGE_FORMAT_BY_MIME = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (type === "image/webp") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && bytes[8] === 0x57
      && bytes[9] === 0x45
      && bytes[10] === 0x42
      && bytes[11] === 0x50;
  }
  return false;
}

export async function validateCatalogImageUpload(file: File) {
  if (!CATALOG_IMAGE_TYPES.has(file.type)) {
    return "A imagem deve ser JPG, PNG ou WebP.";
  }
  if (file.size > MAX_CATALOG_IMAGE_BYTES) {
    return "A imagem deve ter no máximo 2 MB.";
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasValidSignature(file.type, bytes)) {
    return "O conteúdo do arquivo não corresponde a uma imagem JPG, PNG ou WebP válida.";
  }

  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      failOn: "warning",
      limitInputChannels: 4,
      limitInputPixels: MAX_CATALOG_IMAGE_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const expectedFormat = IMAGE_FORMAT_BY_MIME[file.type as keyof typeof IMAGE_FORMAT_BY_MIME];

    if (metadata.format !== expectedFormat) {
      return "O formato real da imagem não corresponde ao tipo do arquivo.";
    }
    if (!metadata.width || !metadata.height) {
      return "Não foi possível identificar as dimensões da imagem.";
    }
    if (metadata.width > MAX_CATALOG_IMAGE_EDGE || metadata.height > MAX_CATALOG_IMAGE_EDGE) {
      return "A imagem deve ter no máximo 8.000 pixels em cada lado.";
    }
    if ((metadata.pages ?? 1) > 1) {
      return "Imagens animadas não são aceitas. Envie uma imagem estática.";
    }

    // Força uma decodificação mínima para rejeitar arquivos truncados ou
    // corrompidos que tenham apenas o cabeçalho aparentemente válido.
    await image.clone().resize({ fit: "inside", height: 1, width: 1 }).toBuffer();
  } catch {
    return "A imagem está corrompida, incompleta ou possui dimensões grandes demais.";
  }

  return null;
}
