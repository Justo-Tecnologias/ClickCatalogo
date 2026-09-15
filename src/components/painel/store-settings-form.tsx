"use client";

import { ExternalLink, Eye, ImageIcon, LoaderCircle, Save, Settings2, Trash2, Upload } from "lucide-react";
import Link from "next/link";
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
    ? "Nova imagem selecionada. Clique em “Salvar alterações” para publicar."
    : state.remove
      ? "A imagem atual será removida quando você salvar."
    : state.savedUrl
      ? "Esta imagem já está salva e aparece na sua loja."
      : "Você ainda não adicionou esta imagem.";

  return (
    <Field className="sm:col-span-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className={cn(
        "grid min-w-0 gap-3 rounded-[var(--radius-control)] border bg-[var(--app-surface-muted)] p-3",
        kind === "logo" ? "grid-cols-[5.5rem_minmax(0,1fr)] items-center" : "sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center",
      )}>
        <div className={cn(
          "relative overflow-hidden border bg-white",
          kind === "logo" ? "aspect-square w-[5.5rem] rounded-full" : "aspect-[21/9] w-full rounded-md",
        )}>
          {state.previewUrl ? (
            <CatalogImage
              alt={`${label} ${state.fileName ? "selecionada" : "atual"}`}
              className="object-cover"
              fallback={<span className="absolute inset-0 grid place-items-center text-[var(--app-foreground-muted)]"><ImageIcon aria-hidden="true" className="size-6" /></span>}
              fill
              sizes={kind === "logo" ? "88px" : "(max-width: 639px) 100vw, 160px"}
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

        <div className="grid min-w-0 gap-2">
          <label className={buttonVariants({ className: "w-fit max-w-full cursor-pointer", size: "sm", variant: "secondary" })} htmlFor={id}>
            <Upload aria-hidden="true" />
            {hasImage ? "Trocar imagem" : "Adicionar imagem"}
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id={id}
            name={id}
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            type="file"
          />
          <input name={`remove-${kind}`} type="hidden" value={state.remove ? "true" : "false"} />
          {hasImage ? (
            <Button className="w-fit" onClick={onRemove} size="sm" type="button" variant="ghost">
              <Trash2 aria-hidden="true" />
              Remover imagem
            </Button>
          ) : null}
          <p aria-live="polite" className="text-xs leading-5 text-[var(--app-foreground-muted)]">{status}</p>
          {state.fileName ? <p className="truncate text-xs font-medium" title={state.fileName}>{state.fileName}</p> : null}
        </div>
      </div>
      <FieldDescription>{description} Tipos aceitos: JPG, PNG ou WebP. Nós ajustamos o tamanho para você.</FieldDescription>
    </Field>
  );
}

export function StoreSettingsForm({ catalog }: { catalog: PublicCatalog }) {
  const [theme, setTheme] = useState<TenantTheme>(catalog.tema);
  const [name, setName] = useState(catalog.nome_loja);
  const [description, setDescription] = useState(catalog.descricao_curta ?? "");
  const [whatsapp, setWhatsapp] = useState(() => normalizeBrazilWhatsAppInput(catalog.whatsapp));
  const [instagram, setInstagram] = useState(() => normalizeInstagramUsername(catalog.instagram ?? ""));
  const [logoImage, setLogoImage] = useState<StoreImageState>({ fileName: null, previewUrl: catalog.logo_url, remove: false, savedUrl: catalog.logo_url });
  const [bannerImage, setBannerImage] = useState<StoreImageState>({ fileName: null, previewUrl: catalog.banner_url, remove: false, savedUrl: catalog.banner_url });
  const [message, setMessage] = useState<{ text: string; type: "danger" | "success" } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
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
        setMessage({ text, type: "danger" });
        notify({ title: text, variant: "danger" });
        return;
      }

      const result = await updateStoreAction(formData);
      if (result.ok) {
        markImagesAsSaved(result.data ?? { bannerUrl: bannerImage.savedUrl, logoUrl: logoImage.savedUrl });
        form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
          input.value = "";
        });
        setMessage({ text: "Alterações publicadas na sua loja.", type: "success" });
        setDirty(false);
        notify({ title: "Alterações publicadas na sua loja", variant: "success" });
      } else {
        setMessage({ text: result.error, type: "danger" });
        notify({ title: result.error, variant: "danger" });
      }
    });
  }

  const previewCatalog = {
    ...catalog,
    banner_url: bannerImage.previewUrl,
    descricao_curta: description || null,
    instagram: instagram || null,
    logo_url: logoImage.previewUrl,
    nome_loja: name || "Nome da sua loja",
    tema: theme,
    whatsapp,
  };

  return (
    <div className={cn("grid gap-4", dirty && "pb-20 xl:pb-0")}>
      <div aria-label="Visualização da configuração" className="grid grid-cols-2 rounded-[var(--radius-control)] border bg-white p-1 xl:hidden" role="tablist">
        <Button aria-selected={mobileView === "edit"} className="w-full" onClick={() => setMobileView("edit")} role="tab" variant={mobileView === "edit" ? "primary" : "ghost"}><Settings2 aria-hidden="true" />Editar</Button>
        <Button aria-selected={mobileView === "preview"} className="w-full" onClick={() => setMobileView("preview")} role="tab" variant={mobileView === "preview" ? "primary" : "ghost"}><Eye aria-hidden="true" />Prévia</Button>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,0.9fr)]">
      <Card className={cn("p-5 sm:p-6", mobileView !== "edit" && "hidden xl:block")}>
        <form className="grid gap-5" id="store-settings-form" onChange={() => setDirty(true)} onSubmit={submit}>
          {message ? <Alert title={message.text} variant={message.type} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2"><FieldLabel htmlFor="nomeLoja">Nome da loja</FieldLabel><Input id="nomeLoja" maxLength={100} name="nomeLoja" onChange={(event) => setName(event.target.value)} required value={name} /></Field>
            <StoreImageField description="Escolha uma imagem quadrada para representar sua loja." id="logo" kind="logo" label="Logo da loja" onChange={(file) => selectImage("logo", file)} onRemove={() => removeImage("logo")} state={logoImage} />
            <StoreImageField description="Escolha uma imagem larga para o topo da loja. Mantenha textos e elementos importantes no centro, pois as laterais podem ser recortadas em algumas telas." id="banner" kind="banner" label="Banner da loja" onChange={(file) => selectImage("banner", file)} onRemove={() => removeImage("banner")} state={bannerImage} />
            <Field className="sm:col-span-2"><FieldLabel htmlFor="descricaoCurta">Descrição curta</FieldLabel><Textarea id="descricaoCurta" maxLength={180} name="descricaoCurta" onChange={(event) => setDescription(event.target.value)} placeholder="Conte em uma frase o que sua loja oferece." rows={3} value={description} /><FieldDescription>{description.length}/180 caracteres</FieldDescription></Field>
            <Field><FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel><Input autoComplete="tel" id="whatsapp" inputMode="tel" maxLength={19} name="whatsapp" onChange={(event) => setWhatsapp(normalizeBrazilWhatsAppInput(event.target.value))} placeholder="+55 (11) 99999-9999" required type="tel" value={formatBrazilWhatsApp(whatsapp)} /><FieldDescription>Digite o número completo com 55 e o DDD. Exemplo: +55 (11) 99999-9999.</FieldDescription></Field>
            <Field>
              <FieldLabel htmlFor="instagram">Instagram da loja</FieldLabel>
              <div className="flex h-11 min-w-0 items-center rounded-[var(--radius-control)] border bg-white transition-[border-color,box-shadow] hover:border-neutral-400 focus-within:border-brand-600 focus-within:shadow-[var(--focus-ring)]">
                <span aria-hidden="true" className="shrink-0 pl-3 text-sm font-semibold text-[var(--app-foreground-muted)]">@</span>
                <Input
                  autoCapitalize="none"
                  autoComplete="off"
                  className="h-full min-w-0 flex-1 rounded-l-none border-0 bg-transparent pl-1 hover:border-0 focus:border-0 focus:shadow-none"
                  id="instagram"
                  maxLength={120}
                  name="instagram"
                  onChange={(event) => setInstagram(normalizeInstagramUsername(event.target.value))}
                  placeholder="sualoja"
                  spellCheck={false}
                  value={instagram}
                />
              </div>
              <FieldDescription>Digite apenas o nome do perfil. Se você colar o link completo do Instagram, nós ajustamos para você.</FieldDescription>
            </Field>
            <Field className="sm:col-span-2"><FieldLabel htmlFor="endereco">Endereço</FieldLabel><Input defaultValue={catalog.endereco ?? ""} id="endereco" maxLength={240} name="endereco" placeholder="Rua, número, bairro e cidade" /></Field>
          </div>

          <div><p className="mb-3 text-sm font-semibold">Tema da loja</p><input name="tema" type="hidden" value={theme} /><ThemePicker onValueChange={(value) => { setTheme(value); setDirty(true); }} value={theme} /></div>
          <div className="flex flex-wrap gap-2"><Button disabled={isPending || !dirty} type="submit">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{isPending ? "Publicando..." : dirty ? "Salvar alterações" : "Tudo salvo"}</Button><Link className={buttonVariants({ variant: "secondary" })} href={`/loja/${catalog.slug}`} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" />Abrir loja</Link></div>
        </form>
      </Card>

      <div className={cn("self-start xl:sticky xl:top-6", mobileView !== "preview" && "hidden xl:block")}><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Como sua loja vai aparecer</p><StorePreview catalog={previewCatalog} framed theme={theme} /></div>
      </div>
      {dirty && mobileView === "edit" ? <div className="fixed inset-x-4 bottom-4 z-20 rounded-[var(--radius-card)] border bg-white p-2 shadow-[var(--shadow-elevation)] xl:hidden"><Button className="w-full" disabled={isPending} form="store-settings-form" type="submit">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{isPending ? "Publicando..." : "Salvar alterações"}</Button></div> : null}
      <ConfirmDialog confirmLabel="Sair sem salvar" description="As alterações feitas na configuração da loja serão perdidas." onCancel={unsavedNavigation.cancelNavigation} onConfirm={unsavedNavigation.confirmNavigation} open={unsavedNavigation.navigationPending} title="Descartar alterações?" />
    </div>
  );
}
