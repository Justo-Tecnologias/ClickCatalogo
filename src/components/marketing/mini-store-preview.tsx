import { MessageCircle } from "lucide-react";
import Image from "next/image";

import { formatCurrency } from "@/lib/format/currency";
import { SHOWCASE_NICHES, type ShowcaseNiche } from "@/lib/marketing/store-showcase";

// Miniatura da loja para a landing: só o desenho (banner, nome, cores do tema
// e 4 produtos), sem carrinho nem busca, para continuar leve. A loja completa
// fica em /exemplo.
export function MiniStorePreview({ niche, storeName }: { niche: ShowcaseNiche; storeName: string }) {
  const template = SHOWCASE_NICHES[niche];
  const categories: readonly { produtos: readonly { imagem: string; nome: string; preco: number }[] }[] = template.categorias;
  const products = categories.flatMap((category) => category.produtos).slice(0, 4);

  return (
    <figure
      aria-label={`Prévia da loja ${storeName}`}
      className="mx-auto w-full max-w-[13rem] rounded-[2rem] border-[6px] border-brand-900 bg-brand-900 shadow-[0_24px_60px_rgb(19_50_41_/_22%)]"
    >
      <div className="h-[26rem] overflow-hidden rounded-[1.6rem] bg-[var(--cor-fundo)] text-[var(--cor-texto)]" data-tema={template.tema}>
        <div className="relative h-24 bg-[var(--cor-imagem-fundo)]">
          <Image alt="" className="object-cover" fill sizes="208px" src={template.banner} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          <div className="absolute inset-x-3 bottom-2 text-white">
            <p className="truncate text-sm font-bold leading-tight">{storeName}</p>
            <p className="mt-0.5 line-clamp-2 text-[0.55rem] leading-tight text-white/85">{template.descricao}</p>
          </div>
        </div>
        <div className="px-2.5 pt-2.5">
          <p className="flex h-7 items-center justify-center gap-1 rounded-md bg-[var(--cor-acao)] text-[0.6rem] font-semibold text-[var(--cor-na-acao)]">
            <MessageCircle aria-hidden="true" className="size-3" />
            Falar no WhatsApp
          </p>
          <p className="mt-2.5 text-[0.65rem] font-bold">{template.categorias[0].nome}</p>
          <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
            {products.map((product) => (
              <li className="overflow-hidden rounded-md border border-[var(--cor-borda)] bg-[var(--cor-superficie)]" key={product.nome}>
                <div className="relative aspect-square bg-[var(--cor-imagem-fundo)]">
                  <Image alt="" className="object-cover" fill sizes="96px" src={product.imagem} />
                </div>
                <div className="p-1.5">
                  <p className="truncate text-[0.55rem] font-semibold">{product.nome}</p>
                  <p className="text-[0.6rem] font-bold text-[var(--cor-primaria)]">{formatCurrency(product.preco)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}
