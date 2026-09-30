import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const css = await readFile(resolve("src/styles/themes.css"), "utf8");
const themePattern = /\[data-tema="([^"]+)"\]\s*\{([^}]+)\}/g;
const themes = [...css.matchAll(themePattern)];

if (themes.length !== 6) {
  throw new Error(`Esperados 6 temas, encontrados ${themes.length}.`);
}

function readColor(block, property) {
  const match = block.match(new RegExp(`${property}:\\s*(#[0-9a-fA-F]{6})`));

  if (!match) {
    throw new Error(`Propriedade ${property} ausente ou inválida.`);
  }

  return match[1];
}

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

for (const [, themeName, block] of themes) {
  const accent = readColor(block, "--cor-acao");
  const accentText = readColor(block, "--cor-na-acao");
  const surface = readColor(block, "--cor-superficie");
  const buttonContrast = contrast(accent, accentText);
  const textContrast = contrast(accent, surface);

  if (buttonContrast < 4.5 || textContrast < 4.5) {
    throw new Error(
      `${themeName}: contraste insuficiente (botão ${buttonContrast.toFixed(2)}, texto ${textContrast.toFixed(2)}).`,
    );
  }
}

const themeColorsSource = await readFile(resolve("src/lib/design-system/theme-colors.ts"), "utf8");
const themeColorTokens = {
  accent: "--cor-acao",
  accentText: "--cor-na-acao",
  background: "--cor-fundo",
  foreground: "--cor-texto",
};

for (const [, themeName, block] of themes) {
  const entry = themeColorsSource.match(new RegExp(`\\b${themeName}:\\s*\\{([^}]+)\\}`));
  if (!entry) throw new Error(`${themeName}: tema ausente em theme-colors.ts.`);

  for (const [key, property] of Object.entries(themeColorTokens)) {
    const value = entry[1].match(new RegExp(`\\b${key}:\\s*"(#[0-9a-fA-F]{6})"`))?.[1];
    const expected = readColor(block, property);
    if (value?.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`${themeName}: theme-colors.ts ${key}=${value ?? "ausente"} diverge de ${property}=${expected} em themes.css.`);
    }
  }
}

console.log("Contraste AA validado nos 6 temas.");
console.log("Cores de theme-colors.ts sincronizadas com themes.css.");
