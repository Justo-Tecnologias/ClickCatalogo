"use client";

import { ImageIcon, Package, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { deleteProductAction, saveProductAction, toggleProductAction } from "@/app/painel/(app)/produtos/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format/currency";
import { compressImageForUpload } from "@/lib/images/compress-upload";
import { CatalogImage } from "@/components/loja-publica/catalog-image";

type CategoryOption = { id: string; nome: string };
export type ProductItem = { ativo: boolean; category_id: string; descricao: string | null; id: string; imagem_url: string | null; nome: string; preco: number; variacao_info: string | null };

export function ProductManager({ categories, initialProducts }: { categories: CategoryOption[]; initialProducts: ProductItem[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<ProductItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEditor(product: ProductItem | null = null) { setEditing(product); setEditorOpen(true); setError(null); }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("ativo", String(editing?.ativo ?? true));
    if (editing) formData.set("id", editing.id);
    startTransition(async () => {
      const image = formData.get("imagem");
      if (image instanceof File && image.size > 0) {
        try {
          formData.set("imagem", await compressImageForUpload(image, {
            maxHeight: 1200,
            maxWidth: 1200,
          }));
        } catch (compressionError) {
          return setError(compressionError instanceof Error
            ? compressionError.message
            : "Não foi possível otimizar a imagem.");
        }
      }

      const result = await saveProductAction(formData);
      if (!result.ok) return setError(result.error);
      const savedProduct = result.data;
      if (savedProduct) {
        setProducts((current) => editing
          ? current.map((product) => product.id === savedProduct.id ? savedProduct : product)
          : [...current, savedProduct]);
      }
      setEditing(null);
      setEditorOpen(false);
      setError(null);
    });
  }

  function toggle(product: ProductItem) {
    const nextValue = !product.ativo;
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ativo: nextValue } : item));
    startTransition(async () => {
      const result = await toggleProductAction(product.id, nextValue);
      if (!result.ok) { setError(result.error); setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ativo: product.ativo } : item)); }
    });
  }

  function remove(product: ProductItem) {
    if (!window.confirm(`Excluir “${product.nome}”? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (!result.ok) return setError(result.error);
      setProducts((current) => current.filter((item) => item.id !== product.id));
    });
  }

  if (categories.length === 0) {
    return <EmptyState action={<Link className={buttonVariants()} href="/painel/categorias"><Plus aria-hidden="true" />Criar primeira categoria</Link>} description="Todo produto precisa pertencer a uma categoria. Crie uma para começar." icon={Package} title="Crie uma categoria primeiro" />;
  }

  return (
    <div className="grid min-w-0 gap-5">
      {error ? <Alert title={error} variant="danger" /> : null}

      {editorOpen ? (
        <Card className="p-5 sm:p-6">
          <form className="grid gap-5" onSubmit={submit}>
            <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">{editing ? "Editar produto" : "Novo produto"}</h2><p className="text-sm text-[var(--app-foreground-muted)]">Informações exibidas no card da sua loja.</p></div><Button aria-label="Fechar formulário" onClick={() => setEditorOpen(false)} size="icon" variant="ghost"><X aria-hidden="true" /></Button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="nome">Nome</FieldLabel><Input defaultValue={editing?.nome} id="nome" maxLength={120} name="nome" placeholder="Ex.: Kit presenteável" required /></Field>
              <Field><FieldLabel htmlFor="categoryId">Categoria</FieldLabel><Select defaultValue={editing?.category_id ?? categories[0]?.id} id="categoryId" name="categoryId" required>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</Select></Field>
              <Field><FieldLabel htmlFor="preco">Preço</FieldLabel><Input defaultValue={editing?.preco.toFixed(2).replace(".", ",")} id="preco" inputMode="decimal" name="preco" placeholder="27,00" required /></Field>
              <Field><FieldLabel htmlFor="imagem">Imagem</FieldLabel><Input accept="image/jpeg,image/png,image/webp" id="imagem" name="imagem" type="file" />{editing?.imagem_url ? <label className="flex min-h-11 items-center gap-2 text-sm"><input className="size-4 accent-[var(--brand-700)]" name="removeImagem" type="checkbox" value="true" />Remover a imagem atual ao salvar</label> : null}<FieldDescription>JPG, PNG ou WebP. Otimizamos para WebP em até 1200 px antes do envio.</FieldDescription></Field>
            </div>
            <Field><FieldLabel htmlFor="descricao">Descrição</FieldLabel><Textarea defaultValue={editing?.descricao ?? ""} id="descricao" maxLength={1000} name="descricao" placeholder="Conte o que torna este produto especial." rows={4} /></Field>
            <Field><FieldLabel htmlFor="variacaoInfo">Variações</FieldLabel><Input defaultValue={editing?.variacao_info ?? ""} id="variacaoInfo" maxLength={300} name="variacaoInfo" placeholder="Ex.: tamanhos P, M e G; cores sob consulta" /><FieldDescription>Campo livre para sabores, tamanhos, cores ou outras opções.</FieldDescription></Field>
            <div className="flex flex-wrap gap-2"><Button disabled={isPending} type="submit">{isPending ? "Salvando..." : "Salvar produto"}</Button><Button onClick={() => setEditorOpen(false)} type="button" variant="ghost">Cancelar</Button></div>
          </form>
        </Card>
      ) : <div><Button onClick={() => openEditor()}><Plus aria-hidden="true" />Novo produto</Button></div>}

      {products.length === 0 && !editorOpen ? (
        <EmptyState action={<Button onClick={() => openEditor()}><Plus aria-hidden="true" />Criar primeiro produto</Button>} description="Adicione seu primeiro item para começar a receber pedidos pelo WhatsApp." icon={Package} title="Nenhum produto ainda" />
      ) : products.length > 0 ? (
        <div className="grid min-w-0 gap-3">
          {products.map((product) => (
            <Card className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 p-3 sm:flex sm:gap-4 sm:p-4" key={product.id}>
              <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--app-surface-muted)] sm:size-16">
                {product.imagem_url ? <CatalogImage alt={`Imagem de ${product.nome}`} className="object-cover" fallback={<ImageIcon aria-hidden="true" className="size-5 text-[var(--app-foreground-muted)]" />} fill loading="lazy" sizes="64px" src={product.imagem_url} /> : <ImageIcon aria-hidden="true" className="size-5 text-[var(--app-foreground-muted)]" />}
              </div>
              <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"><p className="max-w-full truncate font-semibold">{product.nome}</p><Badge variant={product.ativo ? "success" : "neutral"}>{product.ativo ? "Publicado" : "Oculto"}</Badge></div><p className="mt-1 text-sm font-semibold text-brand-700">{formatCurrency(product.preco)}</p></div>
              <div className="col-start-2 flex shrink-0 gap-1 sm:col-auto">
                <Button aria-label={product.ativo ? `Ocultar ${product.nome}` : `Publicar ${product.nome}`} disabled={isPending} onClick={() => toggle(product)} size="icon" variant="ghost"><Power aria-hidden="true" /></Button>
                <Button aria-label={`Editar ${product.nome}`} onClick={() => openEditor(product)} size="icon" variant="ghost"><Pencil aria-hidden="true" /></Button>
                <Button aria-label={`Excluir ${product.nome}`} disabled={isPending} onClick={() => remove(product)} size="icon" variant="ghost"><Trash2 aria-hidden="true" /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
