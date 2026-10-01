// Informações de atendimento da loja (formas de pagamento, entrega/retirada e
// horário). Fonte única das opções e dos textos usados no painel, na loja
// pública e no carrinho. Os valores precisam coincidir com os checks da
// migration 202610010027_store_service_info.sql.

export const PAYMENT_METHODS = [
  { id: "pix", label: "Pix" },
  { id: "credito", label: "Cartão de crédito" },
  { id: "debito", label: "Cartão de débito" },
  { id: "dinheiro", label: "Dinheiro" },
] as const;

export const DELIVERY_MODES = [
  { id: "entrega", label: "Faz entrega" },
  { id: "retirada", label: "Retirada no local" },
  { id: "ambos", label: "Entrega e retirada" },
] as const;

export const STORE_INFO_LIMITS = {
  deliveryNote: 120,
  hours: 80,
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export type DeliveryMode = (typeof DELIVERY_MODES)[number]["id"];

export type StoreServiceInfo = {
  entrega_modo: DeliveryMode | null;
  entrega_observacao: string | null;
  formas_pagamento: PaymentMethod[];
  horario_atendimento: string | null;
};

export const EMPTY_STORE_SERVICE_INFO: StoreServiceInfo = {
  entrega_modo: null,
  entrega_observacao: null,
  formas_pagamento: [],
  horario_atendimento: null,
};

const paymentLabel = new Map<string, string>(PAYMENT_METHODS.map((method) => [method.id, method.label]));
const deliveryLabel = new Map<string, string>(DELIVERY_MODES.map((mode) => [mode.id, mode.label]));

/** Formas de pagamento na ordem canônica, sem duplicidade nem valores desconhecidos. */
export function normalizePaymentMethods(values: readonly string[]): PaymentMethod[] {
  return PAYMENT_METHODS.map((method) => method.id).filter((id) => values.includes(id));
}

export function paymentMethodLabel(method: PaymentMethod) {
  return paymentLabel.get(method)!;
}

export function deliveryModeText(mode: DeliveryMode | null) {
  return mode ? deliveryLabel.get(mode) ?? null : null;
}

export function hasStoreServiceInfo(info: StoreServiceInfo) {
  return info.formas_pagamento.length > 0 || Boolean(info.entrega_modo) || Boolean(info.horario_atendimento);
}
