const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  return currencyFormatter.format(Number(digits) / 100);
}

export function formatCurrencyInputValue(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  return currencyFormatter.format(value);
}

export function parseBrazilianCurrency(value: string): number {
  const compact = value.trim().replace(/^R\$\s?/, "").replace(/\s/g, "");
  if (!compact) return Number.NaN;

  let normalized = compact;
  if (compact.includes(",")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}
