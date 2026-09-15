"use client";

import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { deleteCategoryAction, reorderCategoriesAction, saveCategoryAction } from "@/app/painel/(app)/categorias/actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PendingLink } from "@/components/ui/pending-link";
import { useToast } from "@/components/ui/toast";

export type CategoryItem = { id: string; nome: string; ordem: number; productCount: number };

export function CategoryManager({ initialCategories }: { initialCategories: CategoryItem[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [creating, setCreating] = useState(initialCategories.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [showGroupingSuggestion, setShowGroupingSuggestion] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [linkedCategory, setLinkedCategory] = useState<CategoryItem | null>(null);
  const [operation, setOperation] = useState<"delete" | "reorder" | "save" | null>(null);
  const [isPending, startTransition] = useTransition();
  const notify = useToast();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setOperation("save");
    startTransition(async () => {
      const result = await saveCategoryAction({ id: editing?.id, nome: String(form.get("nome") ?? "") });
      if (!result.ok) {
        setOperation(null);
        notify({ title: result.error, variant: "danger" });
        return setError(result.error);
      }
      const savedCategory = result.data?.category;
      if (savedCategory) {
        setCategories((current) => editing
          ? current.map((category) => category.id === savedCategory.id
            ? { ...category, nome: savedCategory.nome, ordem: savedCategory.ordem }
            : category)
          : [...current, { ...savedCategory, productCount: 0 }]);
      }
      if (result.data?.showGroupingSuggestion) setShowGroupingSuggestion(true);
      setError(null);
      setCreating(false);
      setEditing(null);
      setOperation(null);
      notify({ title: editing ? "Categoria atualizada" : "Categoria criada", variant: "success" });
    });
  }

  function remove(category: CategoryItem) {
    if (category.productCount > 0) {
      const label = category.productCount === 1
        ? "1 produto vinculado"
        : `${category.productCount} produtos vinculados`;
      setError(`A categoria “${category.nome}” possui ${label}. Crie outra categoria e mova os produtos para ela, ou exclua os produtos, antes de excluir a categoria.`);
      setLinkedCategory(category);
      return;
    }
    setLinkedCategory(null);
    setDeleteTarget(category);
  }

  function confirmRemove() {
    if (!deleteTarget) return;
    const category = deleteTarget;
    setOperation("delete");
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (!result.ok) {
        setOperation(null);
        notify({ title: result.error, variant: "danger" });
        return setError(result.error);
      }
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setError(null);
      setDeleteTarget(null);
      setOperation(null);
      notify({ title: "Categoria excluída", variant: "success" });
    });
  }

  function saveOrder(next: CategoryItem[]) {
    const previous = categories;
    setCategories(next);
    setDraggedId(null);
    setOperation("reorder");
    startTransition(async () => {
      const result = await reorderCategoriesAction(next.map((item) => item.id));
      if (!result.ok) {
        setCategories(previous);
        setError(result.error);
        notify({ title: result.error, variant: "danger" });
      } else {
        setError(null);
        notify({ title: "Ordem das categorias atualizada", variant: "success" });
      }
      setOperation(null);
    });
  }

  function move(categoryId: string, offset: -1 | 1) {
    const next = [...categories];
    const from = next.findIndex((item) => item.id === categoryId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= next.length) return;
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    saveOrder(next);
  }

  function drop(overId: string) {
    if (!draggedId || draggedId === overId) return setDraggedId(null);
    const next = [...categories];
    const from = next.findIndex((item) => item.id === draggedId);
    const to = next.findIndex((item) => item.id === overId);
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    saveOrder(next);
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <div className="relative">
          <Alert
            className="pr-14"
            description={linkedCategory ? <PendingLink className={`${buttonVariants({ size: "sm", variant: "secondary" })} mt-2`} href={`/painel/produtos?categoria=${encodeURIComponent(linkedCategory.id)}`} pendingLabel="Abrindo produtos...">Ver produtos desta categoria</PendingLink> : undefined}
            title={error}
            variant="danger"
          />
          <Button
            aria-label="Fechar aviso"
            className="absolute right-1.5 top-1.5"
            onClick={() => { setError(null); setLinkedCategory(null); }}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {showGroupingSuggestion ? (
        <div className="relative">
          <Alert
            className="pr-14"
            description="Considere agrupar categorias parecidas para deixar a navegação do catálogo mais simples para seus clientes. Você pode continuar criando categorias normalmente."
            title="Seu catálogo chegou a 16 categorias"
            variant="warning"
          />
          <Button
            aria-label="Fechar sugestão"
            className="absolute right-1.5 top-1.5"
            onClick={() => setShowGroupingSuggestion(false)}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {creating || editing ? (
        <Card className="p-5">
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={submit}>
            <Field className="flex-1">
              <FieldLabel htmlFor="nome">{editing ? "Editar categoria" : "Nova categoria"}</FieldLabel>
              <Input autoFocus defaultValue={editing?.nome} id="nome" maxLength={80} name="nome" placeholder="Ex.: Bebidas, Presentes, Serviços" required />
            </Field>
            <div className="flex gap-2">
              <Button disabled={isPending} type="submit"><Plus aria-hidden="true" />{operation === "save" ? "Salvando..." : editing ? "Salvar" : "Adicionar"}</Button>
              {categories.length > 0 ? <Button disabled={isPending} onClick={() => { setCreating(false); setEditing(null); }} type="button" variant="ghost"><X aria-hidden="true" />Cancelar</Button> : null}
            </div>
          </form>
        </Card>
      ) : (
        <div><Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />Nova categoria</Button></div>
      )}

      {categories.length === 0 && !creating ? (
        <EmptyState action={<Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />Criar categoria</Button>} description="Organize seu catálogo para seus clientes encontrarem tudo com facilidade." icon={Tags} title="Nenhuma categoria ainda" />
      ) : categories.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs text-[var(--app-foreground-muted)]">Arraste pelo ícone ou use as setas para reordenar. A ordem aparece igual na loja.</p>
          <p aria-live="polite" className="sr-only">{operation === "reorder" ? "Salvando nova ordem das categorias" : ""}</p>
          {categories.map((category, index) => (
            <Card
              className="flex items-center gap-3 p-3 sm:p-4"
              draggable={!isPending}
              key={category.id}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedId(category.id)}
              onDrop={() => drop(category.id)}
            >
              <GripVertical aria-hidden="true" className="size-5 shrink-0 cursor-grab text-[var(--app-foreground-muted)]" />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{category.nome}</p></div>
              <Button aria-label={`Mover ${category.nome} para cima`} disabled={isPending || index === 0} onClick={() => move(category.id, -1)} size="icon" title="Mover para cima" variant="ghost"><ArrowUp aria-hidden="true" /></Button>
              <Button aria-label={`Mover ${category.nome} para baixo`} disabled={isPending || index === categories.length - 1} onClick={() => move(category.id, 1)} size="icon" title="Mover para baixo" variant="ghost"><ArrowDown aria-hidden="true" /></Button>
              <Button aria-label={`Editar ${category.nome}`} disabled={isPending} onClick={() => { setCreating(false); setEditing(category); }} size="icon" title="Editar categoria" variant="ghost"><Pencil aria-hidden="true" /></Button>
              <Button aria-label={`Excluir ${category.nome}`} disabled={isPending} onClick={() => remove(category)} size="icon" title="Excluir categoria" variant="ghost"><Trash2 aria-hidden="true" /></Button>
            </Card>
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        confirmLabel="Excluir categoria"
        description={deleteTarget ? `A categoria “${deleteTarget.nome}” será excluída. Esta ação não pode ser desfeita.` : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmRemove}
        open={Boolean(deleteTarget)}
        pending={operation === "delete"}
        pendingLabel="Excluindo..."
        title="Excluir categoria?"
      />
    </div>
  );
}
