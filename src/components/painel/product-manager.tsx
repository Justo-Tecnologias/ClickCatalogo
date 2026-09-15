"use client";

import { ImageIcon, LoaderCircle, Package, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { deleteProductAction, saveProductAction, toggleProductAction } from "@/app/painel/(app)/produtos/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatCurrencyInput, formatCurrencyInputValue } from "@/lib/format/currency";
import { compressImageForUpload } from "@/lib/images/compress-upload";
import { CatalogImage } from "@/components/loja-publica/catalog-image";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

type CategoryOption = { id: string; nome: string };
export type ProductItem = { ativo: boolean; category_id: string; descricao: string | null; id: string; imagem_url: string | null; nome: string; preco: number; variacao_info: string | null };

export function ProductManager({ categories, initialCategoryFilter, initialProducts }: { categories: CategoryOption[]; initialCategoryFilter?: string; initialProducts: ProductItem[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<ProductItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(categories.some((category) => category.id === initialCategoryFilter) ? initialCategoryFilter! : "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "hidden" | "published">("all");
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [operation, setOperation] = useState<{ id?: string; type: "delete" | "save" | "toggle" } | null>(null);
  const objectUrl = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const notify = useToast();
  const unsavedNavigation = useUnsavedChanges(editorOpen && editorDirty && !isPending);
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.nome])), [categories]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      if (categoryFilter !== "all" && product.category_id !== categoryFilter) return false;
      if (statusFilter === "published" && !product.ativo) return false;
      if (statusFilter === "hidden" && product.ativo) return false;
      return !normalizedQuery || `${product.nome} ${product.descricao ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    });
  }, [categoryFilter, products, query, statusFilter]);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function openEditor(product: ProductItem | null = null) {
    setEditing(product);
    setPriceInput(product ? formatCurrencyInputValue(product.preco) : "");
    setEditorOpen(true);
    setEditorDirty(false);
    setImagePreview(product?.imagem_url ?? null);
    setError(null);
  }

  function closeEditor(force = false) {
    if (editorDirty && !force) return setDiscardOpen(true);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setImagePreview(null);
    setEditing(null);
    setEditorOpen(false);
    setEditorDirty(false);
    setDiscardOpen(false);
  }

  function selectImage(file: File | null) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = file ? URL.createObjectURL(file) : null;
    setImagePreview(objectUrl.current ?? editing?.imagem_url ?? null);
    setEditorDirty(true);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("ativo", String(editing?.ativo ?? true));
    if (editing) formData.set("id", editing.id);
    setOperation({ type: "save" });
    startTransition(async () => {
      const image = formData.get("imagem");
      if (image instanceof File && image.size > 0) {
        try {
          formData.set("imagem", await compressImageForUpload(image, {
            maxHeight: 1200,
            maxWidth: 1200,
          }));
        } catch (compressionError) {
          const message = compressionError instanceof Error
            ? compressionError.message
            : "Não foi possível otimizar a imagem.";
          setOperation(null);
          notify({ title: message, variant: "danger" });
          return setError(message);
        }
      }

      const result = await saveProductAction(formData);
      if (!result.ok) {
        setOperation(null);
        notify({ title: result.error, variant: "danger" });
        return setError(result.error);
      }
      const savedProduct = result.data;
      if (savedProduct) {
        setProducts((current) => editing
          ? current.map((product) => product.id === savedProduct.id ? savedProduct : product)
          : [...current, savedProduct]);
      }
      const wasEditing = Boolean(editing);
      closeEditor(true);
      setError(null);
      setOperation(null);
      notify({ title: wasEditing ? "Produto atualizado" : "Produto criado", variant: "success" });
    });
  }

  function toggle(product: ProductItem) {
    const nextValue = !product.ativo;
    setOperation({ id: product.id, type: "toggle" });
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ativo: nextValue } : item));
    startTransition(async () => {
      const result = await toggleProductAction(product.id, nextValue);
      if (!result.ok) {
        setError(result.error);
        setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ativo: product.ativo } : item));
        notify({ title: result.error, variant: "danger" });
      } else {
        notify({ title: nextValue ? "Produto publicado" : "Produto ocultado", variant: "success" });
      }
      setOperation(null);
    });
  }

  function remove(product: ProductItem) {
    setDeleteTarget(product);
  }

  function confirmRemove() {
    if (!deleteTarget) return;
    const product = deleteTarget;
    setOperation({ id: product.id, type: "delete" });
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (!result.ok) {
        setOperation(null);
        notify({ title: result.error, variant: "danger" });
        return setError(result.error);
      }
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setDeleteTarget(null);
      setOperation(null);
      notify({ title: "Produto excluído", variant: "success" });
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
          <form className="grid gap-5" onChange={() => setEditorDirty(true)} onSubmit={submit}>
            <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">{editing ? "Editar produto" : "Novo produto"}</h2><p className="text-sm text-[var(--app-foreground-muted)]">Informações exibidas no card da sua loja.</p></div><Button aria-label="Fechar formulário" disabled={isPending} onClick={() => closeEditor()} size="icon" title="Fechar formulário" variant="ghost"><X aria-hidden="true" /></Button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="nome">Nome</FieldLabel><Input defaultValue={editing?.nome} id="nome" maxLength={120} name="nome" placeholder="Ex.: Kit presenteável" required /></Field>
              <Field><FieldLabel htmlFor="categoryId">Categoria</FieldLabel><Select defaultValue={editing?.category_id ?? categories[0]?.id} id="categoryId" name="categoryId" required>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</Select></Field>
              <Field><FieldLabel htmlFor="preco">Preço</FieldLabel><Input id="preco" inputMode="numeric" name="preco" onChange={(event) => setPriceInput(formatCurrencyInput(event.target.value))} placeholder="R$ 27,00" required value={priceInput} /><FieldDescription>Digite os números; centavos e separadores são formatados automaticamente.</FieldDescription></Field>
              <Field>
                <FieldLabel htmlFor="imagem">Imagem</FieldLabel>
                <div className="flex items-start gap-3">
                  <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-[var(--app-surface-muted)]">
                    {imagePreview ? <CatalogImage alt="Prévia da imagem do produto" className="object-cover" fallback={<ImageIcon aria-hidden="true" className="size-5 text-[var(--app-foreground-muted)]" />} fill sizes="80px" src={imagePreview} /> : <ImageIcon aria-hidden="true" className="size-5 text-[var(--app-foreground-muted)]" />}
                  </div>
                  <Input accept="image/jpeg,image/png,image/webp" className="min-w-0" id="imagem" name="imagem" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} type="file" />
                </div>
                {editing?.imagem_url ? <label className="flex min-h-11 items-center gap-2 text-sm"><input className="size-4 accent-[var(--brand-700)]" name="removeImagem" onChange={(event) => { if (event.target.checked) setImagePreview(null); else setImagePreview(objectUrl.current ?? editing.imagem_url); }} type="checkbox" value="true" />Remover a imagem atual ao salvar</label> : null}
                <FieldDescription>JPG, PNG ou WebP. Otimizamos para WebP em até 1200 px antes do envio.</FieldDescription>
              </Field>
            </div>
            <Field><FieldLabel htmlFor="descricao">Descrição</FieldLabel><Textarea defaultValue={editing?.descricao ?? ""} id="descricao" maxLength={1000} name="descricao" placeholder="Conte o que torna este produto especial." rows={4} /></Field>
            <Field><FieldLabel htmlFor="variacaoInfo">Variações</FieldLabel><Input defaultValue={editing?.variacao_info ?? ""} id="variacaoInfo" maxLength={300} name="variacaoInfo" placeholder="Ex.: tamanhos P, M e G; cores sob consulta" /><FieldDescription>Campo livre para sabores, tamanhos, cores ou outras opções.</FieldDescription></Field>
            <div className="flex flex-wrap gap-2"><Button disabled={isPending} type="submit">{operation?.type === "save" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{operation?.type === "save" ? "Otimizando e salvando..." : "Salvar produto"}</Button><Button disabled={isPending} onClick={() => closeEditor()} type="button" variant="ghost">Cancelar</Button></div>
          </form>
        </Card>
      ) : <div><Button onClick={() => openEditor()}><Plus aria-hidden="true" />Novo produto</Button></div>}

      {products.length > 0 ? (
        <Card className="grid gap-3 p-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.45fr)_minmax(10rem,0.4fr)]">
          <Field>
            <FieldLabel htmlFor="product-search">Buscar produtos</FieldLabel>
            <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--app-foreground-muted)]" /><Input className="pl-9" id="product-search" onChange={(event) => { setQuery(event.target.value); setVisibleLimit(30); }} placeholder="Nome ou descrição" type="search" value={query} /></div>
          </Field>
          <Field><FieldLabel htmlFor="product-category-filter">Categoria</FieldLabel><Select id="product-category-filter" onChange={(event) => { setCategoryFilter(event.target.value); setVisibleLimit(30); }} value={categoryFilter}><option value="all">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</Select></Field>
          <Field><FieldLabel htmlFor="product-status-filter">Visibilidade</FieldLabel><Select id="product-status-filter" onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setVisibleLimit(30); }} value={statusFilter}><option value="all">Todos</option><option value="published">Publicados</option><option value="hidden">Ocultos</option></Select></Field>
        </Card>
      ) : null}

      {products.length === 0 && !editorOpen ? (
        <EmptyState action={<Button onClick={() => openEditor()}><Plus aria-hidden="true" />Criar primeiro produto</Button>} description="Adicione seu primeiro item para começar a receber pedidos pelo WhatsApp." icon={Package} title="Nenhum produto ainda" />
      ) : products.length > 0 ? (
        <div className="grid min-w-0 gap-3">
          {filteredProducts.length === 0 ? <EmptyState description="Revise a busca ou os filtros selecionados." icon={Search} title="Nenhum produto encontrado" /> : null}
          {filteredProducts.slice(0, visibleLimit).map((product) => (
            <Card className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 p-3 sm:flex sm:gap-4 sm:p-4" key={product.id}>
              <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--app-surface-muted)] sm:size-16">
                {product.imagem_url ? <CatalogImage alt={`Imagem de ${product.nome}`} className="object-cover" fallback={<ImageIcon aria-hidden="true" className="size-5 text-[var(--app-foreground-muted)]" />} fill loading="lazy" sizes="64px" src={product.imagem_url} /> : <ImageIcon aria-hidden="true" className="size-5 text-[var(--app-foreground-muted)]" />}
              </div>
              <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"><p className="max-w-full truncate font-semibold">{product.nome}</p><Badge variant={product.ativo ? "success" : "neutral"}>{product.ativo ? "Publicado" : "Oculto"}</Badge></div><p className="mt-1 truncate text-xs text-[var(--app-foreground-muted)]">{categoryNames.get(product.category_id) ?? "Categoria não encontrada"}</p><p className="mt-1 text-sm font-semibold text-brand-700">{formatCurrency(product.preco)}</p></div>
              <div className="col-start-2 flex shrink-0 gap-1 sm:col-auto">
                <Button aria-label={product.ativo ? `Ocultar ${product.nome}` : `Publicar ${product.nome}`} disabled={isPending} onClick={() => toggle(product)} size="icon" title={product.ativo ? "Ocultar produto" : "Publicar produto"} variant="ghost">{operation?.type === "toggle" && operation.id === product.id ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Power aria-hidden="true" />}</Button>
                <Button aria-label={`Editar ${product.nome}`} disabled={isPending} onClick={() => openEditor(product)} size="icon" title="Editar produto" variant="ghost"><Pencil aria-hidden="true" /></Button>
                <Button aria-label={`Excluir ${product.nome}`} disabled={isPending} onClick={() => remove(product)} size="icon" title="Excluir produto" variant="ghost"><Trash2 aria-hidden="true" /></Button>
              </div>
            </Card>
          ))}
          {filteredProducts.length > visibleLimit ? <div className="flex justify-center pt-2"><Button onClick={() => setVisibleLimit((current) => current + 30)} variant="secondary">Carregar mais produtos</Button></div> : null}
        </div>
      ) : null}
      <ConfirmDialog confirmLabel="Excluir produto" description={deleteTarget ? `“${deleteTarget.nome}” será removido permanentemente do catálogo.` : "Este produto será removido permanentemente."} onCancel={() => setDeleteTarget(null)} onConfirm={confirmRemove} open={Boolean(deleteTarget)} pending={operation?.type === "delete"} pendingLabel="Excluindo..." title="Excluir produto?" />
      <ConfirmDialog confirmLabel="Descartar alterações" description="As informações preenchidas neste formulário não serão salvas." onCancel={() => setDiscardOpen(false)} onConfirm={() => closeEditor(true)} open={discardOpen} title="Sair sem salvar?" />
      <ConfirmDialog confirmLabel="Sair sem salvar" description="As alterações feitas no produto serão perdidas." onCancel={unsavedNavigation.cancelNavigation} onConfirm={unsavedNavigation.confirmNavigation} open={unsavedNavigation.navigationPending} title="Descartar alterações?" />
    </div>
  );
}
