"use client";

import { ArrowLeft, CheckCircle2, Eye, ImageIcon, LoaderCircle, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { updateStoreAction } from "@/app/painel/(app)/loja/actions";
import { StorePreview } from "@/components/loja-publica/store-preview";
import { CatalogImage } from "@/components/loja-publica/catalog-image";
import { ThemePicker } from "@/components/loja-publica/theme-picker";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatBrazilWhatsApp, normalizeBrazilWhatsAppInput } from "@/lib/whatsapp/url";
import { compressImageForUpload } from "@/lib/images/compress-upload";
import { normalizeInstagramUsername } from "@/lib/instagram/username";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils/cn";
import type { PublicCatalog } from "@/types/catalog";
import type { TenantTheme } from "@/types/database";

type StoreImageKind = "banner" | "logo";

type StoreImageState = {
  fileName: string | null;
  previewUrl: string | null;
  remove: boolean;
  savedUrl: string | null;
};

function StoreFormSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{title}</h2>
      {children}
    </section>
  );
}

function StoreImageField({
  description,
  id,
  kind,
  label,
  onChange,
  onRemove,
  state,
}: {
  description: string;
  id: StoreImageKind;
  kind: StoreImageKind;
  label: string;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  state: StoreImageState;
}) {
  const hasImage = Boolean(state.previewUrl);
  const status = state.fileName
    ? "Nova imagem pronta para salvar."
    : state.remove
      ? "A imagem será removida ao salvar."
      : null;

  return (
    <Field className="sm:col-span-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className={cn(
        "grid min-w-0 gap-3 rounded-[var(--radius-control)] border bg-[var(--app-surface-muted)] p-3",
        kind === "logo" ? "grid-cols-[4.5rem_minmax(0,1fr)] items-center" : "sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center",
      )}>
        <div className={cn(
          "relative overflow-hidden border bg-white",
          kind === "logo" ? "aspect-square w-[4.5rem] rounded-full" : "mx-auto aspect-[21/9] w-[90%] rounded-md sm:mx-0 sm:w-full",
        )}>
          {state.previewUrl ? (
            <CatalogImage
              alt={`${label} ${state.fileName ? "selecionada" : "atual"}`}
              className="object-cover"
              fallback={<span className="absolute inset-0 grid place-items-center text-[var(--app-foreground-muted)]"><ImageIcon aria-hidden="true" className="size-6" /></span>}
              fill
              sizes={kind === "logo" ? "72px" : "(max-width: 639px) 100vw, 160px"}
              src={state.previewUrl}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-[var(--app-foreground-muted)]">
              <ImageIcon aria-hidden="true" className="size-6" />
            </span>
          )}
          {hasImage ? (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-1 text-[0.625rem] font-semibold text-white">
              {state.fileName ? "Nova" : "Atual"}
            </span>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <label className={buttonVariants({ className: "max-w-full cursor-pointer", size: "sm", variant: "secondary" })} htmlFor={id}>
              <Upload aria-hidden="true" />
              {hasImage ? (kind === "banner" ? "Trocar banner" : "Trocar imagem") : "Adicionar imagem"}
            </label>
            {hasImage ? (
              <Button aria-label={`Remover ${label.toLowerCase()}`} onClick={onRemove} size="sm" type="button" variant="ghost">
                <Trash2 aria-hidden="true" />
                Remover
              </Button>
            ) : null}
          </div>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id={id}
            name={id}
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            type="file"
          />
          <input name={`remove-${kind}`} type="hidden" value={state.remove ? "true" : "false"} />
          {status ? <p aria-live="polite" className="text-xs leading-5 text-[var(--app-foreground-muted)]">{status}</p> : null}
          {state.fileName ? <p className="truncate text-xs font-medium" title={state.fileName}>{state.fileName}</p> : null}
        </div>
      </div>
      <FieldDescription>{description} JPG, PNG ou WebP • até 2 MB.</FieldDescription>
    </Field>
  );
}

function StorePreviewDialog({
  catalog,
  onClose,
  open,
}: {
  catalog: PublicCatalog;
  onClose: () => void;
  open: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      aria-describedby="store-preview-description"
      aria-labelledby="store-preview-title"
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-white p-0 text-[var(--app-foreground)] backdrop:bg-black/50 xl:hidden"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="flex h-dvh min-h-0 flex-col bg-[var(--app-background)]">
        <header className="relative z-20 flex min-h-16 shrink-0 items-center gap-3 border-b bg-white px-3 shadow-sm sm:px-5">
          <Button aria-label="Voltar à edição" onClick={onClose} size="icon" variant="ghost">
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h2 className="font-bold" id="store-preview-title">Prévia da loja</h2>
            <p className="truncate text-xs text-[var(--app-foreground-muted)]" id="store-preview-description">
              Mostra suas alterações atuais sem publicá-las.
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <StorePreview
            catalog={catalog}
            className="min-h-full rounded-none border-0 shadow-none"
            framed
            theme={catalog.tema}
          />
        </div>
      </div>
    </dialog>
  );
}

export function StoreSettingsForm({ catalog }: { catalog: PublicCatalog }) {
  const [theme, setTheme] = useState<TenantTheme>(catalog.tema);
  const [name, setName] = useState(catalog.nome_loja);
  const [description, setDescription] = useState(catalog.descricao_curta ?? "");
  const [whatsapp, setWhatsapp] = useState(() => normalizeBrazilWhatsAppInput(catalog.whatsapp));
  const [instagram, setInstagram] = useState(() => normalizeInstagramUsername(catalog.instagram ?? ""));
  const [address, setAddress] = useState(catalog.endereco ?? "");
  const [logoImage, setLogoImage] = useState<StoreImageState>({ fileName: null, previewUrl: catalog.logo_url, remove: false, savedUrl: catalog.logo_url });
  const [bannerImage, setBannerImage] = useState<StoreImageState>({ fileName: null, previewUrl: catalog.banner_url, remove: false, savedUrl: catalog.banner_url });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const objectUrls = useRef<Partial<Record<StoreImageKind, string>>>({});
  const notify = useToast();
  const unsavedNavigation = useUnsavedChanges(dirty && !isPending);

  useEffect(() => () => {
    Object.values(objectUrls.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function selectImage(kind: StoreImageKind, file: File | null) {
    setDirty(true);
    const previousObjectUrl = objectUrls.current[kind];
    if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);

    const setImage = kind === "logo" ? setLogoImage : setBannerImage;
    setImage((current) => {
      if (!file) {
        delete objectUrls.current[kind];
        return { ...current, fileName: null, previewUrl: current.savedUrl, remove: false };
      }

      const previewUrl = URL.createObjectURL(file);
      objectUrls.current[kind] = previewUrl;
      return { ...current, fileName: file.name, previewUrl, remove: false };
    });
  }

  function removeImage(kind: StoreImageKind) {
    setDirty(true);
    const previousObjectUrl = objectUrls.current[kind];
    if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
    delete objectUrls.current[kind];

    const setImage = kind === "logo" ? setLogoImage : setBannerImage;
    setImage((current) => ({ ...current, fileName: null, previewUrl: null, remove: true }));
  }

  function markImagesAsSaved(data: { bannerUrl: string | null; logoUrl: string | null }) {
    Object.values(objectUrls.current).forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current = {};
    setLogoImage({ fileName: null, previewUrl: data.logoUrl, remove: false, savedUrl: data.logoUrl });
    setBannerImage({ fileName: null, previewUrl: data.bannerUrl, remove: false, savedUrl: data.bannerUrl });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const logo = formData.get("logo");
        const banner = formData.get("banner");
        const [optimizedLogo, optimizedBanner] = await Promise.all([
          logo instanceof File && logo.size > 0
            ? compressImageForUpload(logo, { maxHeight: 800, maxWidth: 800 })
            : null,
          banner instanceof File && banner.size > 0
            ? compressImageForUpload(banner, { maxHeight: 900, maxWidth: 1600 })
            : null,
        ]);
        if (optimizedLogo) formData.set("logo", optimizedLogo);
        if (optimizedBanner) formData.set("banner", optimizedBanner);
      } catch (compressionError) {
        const text = compressionError instanceof Error ? compressionError.message : "Não foi possível otimizar as imagens.";
        setErrorMessage(text);
        notify({ title: text, variant: "danger" });
        return;
      }

      const result = await updateStoreAction(formData);
      if (result.ok) {
        markImagesAsSaved(result.data ?? { bannerUrl: bannerImage.savedUrl, logoUrl: logoImage.savedUrl });
        form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
          input.value = "";
        });
        setDirty(false);
        notify({ title: "Alterações salvas", variant: "success" });
      } else {
        setErrorMessage(result.error);
        notify({ title: result.error, variant: "danger" });
      }
    });
  }

  const previewCatalog = {
    ...catalog,
    banner_url: bannerImage.previewUrl,
    descricao_curta: description || null,
    endereco: address || null,
    instagram: instagram || null,
    logo_url: logoImage.previewUrl,
    nome_loja: name || "Nome da sua loja",
    tema: theme,
    whatsapp,
  };

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(25rem,0.85fr)]">
        <Card className="border-0 bg-transparent p-0 shadow-none sm:border sm:bg-white sm:p-6 sm:shadow-[var(--shadow-elevation)]">
          <form className="grid gap-6" id="store-settings-form" onChange={() => setDirty(true)} onSubmit={submit}>
            {errorMessage ? (
              <Alert
                description={<Button className="mt-2" disabled={isPending} size="sm" type="submit" variant="secondary">Tentar novamente</Button>}
                title={errorMessage}
                variant="danger"
              />
            ) : null}

            <StoreFormSection title="Informações">
              <div className="grid gap-4">
                <Field><FieldLabel htmlFor="nomeLoja">Nome da loja</FieldLabel><Input id="nomeLoja" maxLength={100} name="nomeLoja" onChange={(event) => setName(event.target.value)} required value={name} /></Field>
                <Field><FieldLabel htmlFor="descricaoCurta">Descrição</FieldLabel><Textarea id="descricaoCurta" maxLength={180} name="descricaoCurta" onChange={(event) => setDescription(event.target.value)} placeholder="Conte em uma frase o que sua loja oferece." rows={3} value={description} /><FieldDescription>{description.length}/180 caracteres</FieldDescription></Field>
              </div>
            </StoreFormSection>

            <StoreFormSection title="Contato">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel><Input autoComplete="tel" id="whatsapp" inputMode="tel" maxLength={19} name="whatsapp" onChange={(event) => setWhatsapp(normalizeBrazilWhatsAppInput(event.target.value))} placeholder="+55 (11) 99999-9999" required type="tel" value={formatBrazilWhatsApp(whatsapp)} /><FieldDescription>Número completo com 55 e DDD.</FieldDescription></Field>
                <Field>
                  <FieldLabel htmlFor="instagram">Instagram da loja</FieldLabel>
                  <div className="flex h-11 min-w-0 items-center rounded-[var(--radius-control)] border bg-white transition-[border-color,box-shadow] hover:border-neutral-400 focus-within:border-brand-600 focus-within:shadow-[var(--focus-ring)]">
                    <span aria-hidden="true" className="shrink-0 pl-3 text-sm font-semibold text-[var(--app-foreground-muted)]">@</span>
                    <Input autoCapitalize="none" autoComplete="off" className="h-full min-w-0 flex-1 rounded-l-none border-0 bg-transparent pl-1 hover:border-0 focus:border-0 focus:shadow-none" id="instagram" maxLength={120} name="instagram" onChange={(event) => setInstagram(normalizeInstagramUsername(event.target.value))} placeholder="sualoja" spellCheck={false} value={instagram} />
                  </div>
                  <FieldDescription>Digite o nome do perfil; links completos são ajustados.</FieldDescription>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="endereco">Endereço <span className="font-normal text-[var(--app-foreground-muted)]">(opcional)</span></FieldLabel>
                  <Input id="endereco" maxLength={240} name="endereco" onChange={(event) => setAddress(event.target.value)} placeholder="Rua, número, bairro e cidade" value={address} />
                  <FieldDescription>Será exibido publicamente na sua loja. Deixe vazio se não quiser divulgar.</FieldDescription>
                </Field>
              </div>
            </StoreFormSection>

            <StoreFormSection title="Aparência">
              <div className="grid gap-5">
                <StoreImageField description="Imagem quadrada." id="logo" kind="logo" label="Logo da loja" onChange={(file) => selectImage("logo", file)} onRemove={() => removeImage("logo")} state={logoImage} />
                <StoreImageField description="As bordas podem ser cortadas em alguns celulares." id="banner" kind="banner" label="Banner da loja" onChange={(file) => selectImage("banner", file)} onRemove={() => removeImage("banner")} state={bannerImage} />
                <div><p className="mb-3 text-sm font-semibold">Tema da loja</p><input name="tema" type="hidden" value={theme} /><ThemePicker onValueChange={(value) => { setTheme(value); setDirty(true); }} value={theme} /></div>
              </div>
            </StoreFormSection>

            <div className="hidden items-center justify-between gap-3 xl:flex">
              {dirty ? (
                <Button disabled={isPending} type="submit">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{isPending ? "Salvando..." : "Salvar alterações"}</Button>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-[var(--app-foreground-muted)]"><CheckCircle2 aria-hidden="true" className="size-3.5 text-[var(--app-success)]" />Alterações salvas</p>
              )}
            </div>
            {!dirty ? <p className="flex items-center gap-1.5 text-xs text-[var(--app-foreground-muted)] xl:hidden"><CheckCircle2 aria-hidden="true" className="size-3.5 text-[var(--app-success)]" />Alterações salvas</p> : null}
          </form>
        </Card>

        <div className="hidden self-start xl:sticky xl:top-6 xl:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Como sua loja vai aparecer</p>
          <StorePreview catalog={previewCatalog} framed theme={theme} />
        </div>
      </div>

      <Button
        aria-haspopup="dialog"
        className={cn(
          "fixed right-4 z-30 rounded-full bg-white shadow-[var(--shadow-elevation)] xl:hidden",
          dirty ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
        )}
        onClick={() => setPreviewOpen(true)}
        variant="secondary"
      >
        <Eye aria-hidden="true" />
        Prévia
      </Button>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 px-4 pt-2 shadow-[0_-10px_30px_rgb(18_45_35_/_12%)] backdrop-blur xl:hidden" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <p className="hidden flex-1 text-sm font-medium min-[390px]:block">Alterações não salvas</p>
            <Button className="flex-1 min-[390px]:flex-none" disabled={isPending} form="store-settings-form" type="submit">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{isPending ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </div>
      ) : null}
      <StorePreviewDialog catalog={previewCatalog} onClose={() => setPreviewOpen(false)} open={previewOpen} />
      <ConfirmDialog confirmLabel="Sair sem salvar" description="As alterações feitas na configuração da loja serão perdidas." onCancel={unsavedNavigation.cancelNavigation} onConfirm={unsavedNavigation.confirmNavigation} open={unsavedNavigation.navigationPending} title="Descartar alterações?" />
    </div>
  );
}
