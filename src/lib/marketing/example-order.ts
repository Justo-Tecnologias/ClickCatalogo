import "server-only";

import { DEMO_PRODUCTS } from "@/lib/demo/panel-demo";
import type { CartLine } from "@/lib/whatsapp/cart-message";

export const EXAMPLE_STORE_NAME = "Ateliê Aurora";
export const EXAMPLE_STORE_PATH = "/loja/atelie-aurora";

// Pedido usado nas páginas de divulgação: o mesmo do print do carrinho.
export function exampleOrder(): CartLine[] {
  const pick = (nome: string, quantity: number): CartLine => {
    const product = DEMO_PRODUCTS.find((item) => item.nome === nome);
    if (!product) throw new Error(`Produto de exemplo ausente: ${nome}`);
    return {
      product: {
        descricao: product.descricao,
        id: product.id,
        imagem_url: product.imagem_url,
        nome: product.nome,
        ordem: product.ordem,
        preco: Number(product.preco),
        variacao_info: product.variacao_info,
      },
      quantity,
    };
  };
  return [pick("Kit Afeto", 2), pick("Vela Aurora", 1), pick("Vela Jardim", 1)];
}
