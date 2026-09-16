"use client";

import { Check, ChevronDown, Copy, Download, ExternalLink, MessageCircle, QrCode, Share2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { trackProductMetric } from "@/lib/analytics/client";
import { cn } from "@/lib/utils/cn";

type StoreLaunchToolsProps = {
  bannerReady: boolean;
  categoryCount: number;
  logoReady: boolean;
  productCount: number;
  storeName: string;
  storeUrl: string;
  whatsappReady: boolean;
};

const STORE_SHARED_EVENT = "clickcatalogo:store-shared";

function sharedStorageKey(storeUrl: string) {
  return `clickcatalogo-onboarding:${storeUrl}:shared`;
}

function markStoreShared(storeUrl: string) {
  const slug = new URL(storeUrl).pathname.split("/").filter(Boolean).at(-1);
  try {
    if (localStorage.getItem(sharedStorageKey(storeUrl)) !== "1") {
      trackProductMetric("catalog_shared", slug);
    }
    localStorage.setItem(sharedStorageKey(storeUrl), "1");
  } catch {
    trackProductMetric("catalog_shared", slug);
  }
  window.dispatchEvent(new CustomEvent(STORE_SHARED_EVENT, { detail: storeUrl }));
}

async function copyStoreLink(storeUrl: string) {
  await navigator.clipboard.writeText(storeUrl);
  markStoreShared(storeUrl);
}

export function StoreTopActions({ storeHref, storeName, storeUrl }: Pick<StoreLaunchToolsProps, "storeName" | "storeUrl"> & { storeHref?: string }) {
  const notify = useToast();

  async function shareStore() {
    if (navigator.share) {
      try {
        await navigator.share({ text: `Conheça o catálogo da ${storeName}.`, title: storeName, url: storeUrl });
        markStoreShared(storeUrl);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await copyStoreLink(storeUrl);
      notify({ title: "Link da loja copiado", variant: "success" });
    } catch {
      notify({ description: "Copie o link na seção Link da loja.", title: "Não foi possível compartilhar agora", variant: "danger" });
    }
  }

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:flex sm:w-auto">
      <Link className={buttonVariants({ className: "min-w-0 w-full px-2 sm:w-auto sm:px-4", variant: "secondary" })} href={storeHref ?? storeUrl} rel="noreferrer" target="_blank">
        <ExternalLink aria-hidden="true" />
        <span className="sm:hidden">Loja publicada</span>
        <span className="hidden sm:inline">Ver loja publicada</span>
      </Link>
      <Button className="min-w-0 w-full px-2 sm:w-auto sm:px-4" onClick={shareStore}>
        <Share2 aria-hidden="true" />
        Compartilhar
      </Button>
    </div>
  );
}

export function StoreOnboardingChecklist(props: StoreLaunchToolsProps) {
  const storagePrefix = `clickcatalogo-onboarding:${props.storeUrl}`;
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    queueMicrotask(() => {
      setExpanded(desktopQuery.matches);
      try {
        setDismissed(localStorage.getItem(`${storagePrefix}:dismissed`) === "1");
        setShared(localStorage.getItem(sharedStorageKey(props.storeUrl)) === "1");
      } catch { /* O checklist continua funcional sem persistência local. */ }
    });

    function onShared(event: Event) {
      if ((event as CustomEvent<string>).detail === props.storeUrl) setShared(true);
    }
    function onBreakpointChange(event: MediaQueryListEvent) {
      setExpanded(event.matches);
    }
    window.addEventListener(STORE_SHARED_EVENT, onShared);
    desktopQuery.addEventListener("change", onBreakpointChange);
    return () => {
      window.removeEventListener(STORE_SHARED_EVENT, onShared);
      desktopQuery.removeEventListener("change", onBreakpointChange);
    };
  }, [props.storeUrl, storagePrefix]);

  const steps = [
    { done: props.whatsappReady, label: "WhatsApp configurado" },
    { done: props.logoReady, label: "Logo adicionada" },
    { done: props.bannerReady, label: "Banner adicionado" },
    { done: props.categoryCount > 0, label: "Primeira categoria criada" },
    { done: props.productCount > 0, label: "Primeiro produto criado" },
    { done: props.productCount >= 5, label: "Cinco produtos publicados" },
    { done: shared, label: "Loja compartilhada" },
  ];
  const completed = steps.filter((step) => step.done).length;
  const remaining = steps.length - completed;
  const percent = Math.round((completed / steps.length) * 100);

  if (dismissed) return null;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start gap-2">
        <button
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-brand-200"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Primeiros passos</span>
              <span className="mt-1 block text-lg font-bold">Sua loja está {percent}% pronta</span>
            </span>
            <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-[var(--app-foreground-muted)] transition-transform", expanded && "rotate-180")} />
          </span>
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]" role="progressbar" aria-label={`${percent}% concluído`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent}>
            <span className="block h-full rounded-full bg-brand-700 transition-[width]" style={{ width: `${percent}%` }} />
          </span>
          <span className="mt-2 block text-sm text-[var(--app-foreground-muted)] xl:hidden">
            {remaining === 0 ? "Tudo pronto para compartilhar" : `Falta${remaining === 1 ? "" : "m"} ${remaining} passo${remaining === 1 ? "" : "s"}`}
          </span>
        </button>
        <Button
          aria-label="Ocultar checklist"
          onClick={() => {
            try { localStorage.setItem(`${storagePrefix}:dismissed`, "1"); } catch { /* Oculta apenas nesta sessão. */ }
            setDismissed(true);
          }}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className={cn("mt-4 border-t pt-3", !expanded && "hidden")}>
        <p className="mb-2 hidden text-sm text-[var(--app-foreground-muted)] xl:block">Complete o essencial e compartilhe quando estiver satisfeito.</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {steps.map((step) => (
            <li className="flex min-h-11 items-center gap-3 text-sm" key={step.label}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", step.done ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "border text-transparent")}>
                <Check aria-hidden="true" className="size-3.5" />
              </span>
              {step.label}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function StoreShareActions({ children, storeName, storeUrl }: Pick<StoreLaunchToolsProps, "storeName" | "storeUrl"> & { children?: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const notify = useToast();

  async function copyLink() {
    try {
      await copyStoreLink(storeUrl);
      notify({ title: "Link da loja copiado", variant: "success" });
    } catch {
      notify({ description: "Selecione o endereço exibido e copie manualmente.", title: "Não foi possível copiar automaticamente", variant: "danger" });
    }
  }

  async function showQrCode() {
    try {
      const dataUrl = await QRCode.toDataURL(storeUrl, { errorCorrectionLevel: "M", margin: 2, width: 720 });
      setQrDataUrl(dataUrl);
      dialogRef.current?.showModal();
    } catch {
      notify({ title: "Não foi possível gerar o QR Code agora", variant: "danger" });
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Divulgação</p>
      <h2 className="mt-1 text-lg font-bold">Link da loja</h2>
      <p className="mt-2 truncate rounded-[var(--radius-control)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm" title={storeUrl}>{storeUrl}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button className="w-full px-2" onClick={copyLink} variant="secondary"><Copy aria-hidden="true" /><span className="hidden min-[360px]:inline">Copiar</span></Button>
        <a className={buttonVariants({ className: "w-full px-2", variant: "secondary" })} href={`https://wa.me/?text=${encodeURIComponent(`Conheça o catálogo da ${storeName}: ${storeUrl}`)}`} onClick={() => markStoreShared(storeUrl)} rel="noreferrer" target="_blank"><MessageCircle aria-hidden="true" /><span className="hidden min-[390px]:inline">WhatsApp</span></a>
        <Button className="w-full whitespace-nowrap px-2 text-xs" onClick={showQrCode} variant="secondary"><QrCode aria-hidden="true" /><span className="hidden whitespace-nowrap min-[360px]:inline">QR Code</span></Button>
      </div>
      {children ? <div className="mt-5 border-t pt-5">{children}</div> : null}

      <dialog aria-describedby="store-qr-description" aria-labelledby="store-qr-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }} ref={dialogRef}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold" id="store-qr-title">QR Code da loja</h2><p className="mt-1 text-sm text-[var(--app-foreground-muted)]" id="store-qr-description">Aponte a câmera para abrir o catálogo.</p></div>
            <Button aria-label="Fechar QR Code" onClick={() => dialogRef.current?.close()} size="icon" variant="ghost"><X aria-hidden="true" /></Button>
          </div>
          {qrDataUrl ? <Image alt={`QR Code para ${storeName}`} className="mx-auto mt-5 aspect-square w-full max-w-72" height={288} src={qrDataUrl} unoptimized width={288} /> : null}
          {qrDataUrl ? <a className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white" download={`qr-code-${storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`} href={qrDataUrl}><Download aria-hidden="true" className="size-4" />Baixar QR Code</a> : null}
        </div>
      </dialog>
    </Card>
  );
}
