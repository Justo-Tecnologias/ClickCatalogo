"use client";

import { Check, Copy, Download, MessageCircle, QrCode, Share2, X } from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { trackProductMetric } from "@/lib/analytics/client";

type StoreLaunchToolsProps = {
  bannerReady: boolean;
  categoryCount: number;
  logoReady: boolean;
  productCount: number;
  storeName: string;
  storeUrl: string;
  whatsappReady: boolean;
};

export function StoreLaunchTools(props: StoreLaunchToolsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const storagePrefix = `clickcatalogo-onboarding:${props.storeUrl}`;
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const notify = useToast();

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setDismissed(localStorage.getItem(`${storagePrefix}:dismissed`) === "1");
        setShared(localStorage.getItem(`${storagePrefix}:shared`) === "1");
      } catch { /* O checklist continua funcional sem persistência local. */ }
    });
  }, [storagePrefix]);

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
  const percent = Math.round((completed / steps.length) * 100);

  function markShared() {
    try {
      if (localStorage.getItem(`${storagePrefix}:shared`) !== "1") {
        trackProductMetric("catalog_shared", new URL(props.storeUrl).pathname.split("/").filter(Boolean).at(-1));
      }
      localStorage.setItem(`${storagePrefix}:shared`, "1");
    } catch {
      trackProductMetric("catalog_shared", new URL(props.storeUrl).pathname.split("/").filter(Boolean).at(-1));
    }
    setShared(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(props.storeUrl);
      markShared();
      setCopied(true);
      notify({ title: "Link da loja copiado", variant: "success" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify({ description: "Selecione e copie o endereço exibido acima.", title: "Não foi possível copiar automaticamente", variant: "danger" });
    }
  }

  async function shareStore() {
    if (navigator.share) {
      try {
        await navigator.share({
          text: `Conheça o catálogo da ${props.storeName}.`,
          title: props.storeName,
          url: props.storeUrl,
        });
        markShared();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  async function showQrCode() {
    try {
      const dataUrl = await QRCode.toDataURL(props.storeUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 720,
      });
      setQrDataUrl(dataUrl);
      dialogRef.current?.showModal();
    } catch {
      notify({ title: "Não foi possível gerar o QR Code agora", variant: "danger" });
    }
  }

  return (
    <div className="grid gap-5">
      {!dismissed ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Primeiros passos</p>
              <h2 className="mt-2 text-xl font-bold">Sua loja está {percent}% pronta</h2>
              <p className="mt-1 text-sm text-[var(--app-foreground-muted)]">Complete o essencial e compartilhe quando estiver satisfeito.</p>
            </div>
            <Button aria-label="Ocultar checklist" onClick={() => { try { localStorage.setItem(`${storagePrefix}:dismissed`, "1"); } catch { /* Oculta apenas nesta sessão. */ } setDismissed(true); }} size="icon" variant="ghost"><X aria-hidden="true" /></Button>
          </div>
          <div aria-label={`${percent}% concluído`} className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent}><div className="h-full rounded-full bg-brand-700 transition-[width]" style={{ width: `${percent}%` }} /></div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {steps.map((step) => <li className="flex min-h-11 items-center gap-3 text-sm" key={step.label}><span className={`grid size-6 shrink-0 place-items-center rounded-full ${step.done ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "border border-[var(--app-border)] text-transparent"}`}><Check aria-hidden="true" className="size-3.5" /></span>{step.label}</li>)}
          </ul>
        </Card>
      ) : null}

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold">Compartilhe sua loja</h2>
        <p className="mt-1 break-all text-sm text-[var(--app-foreground-muted)]">{props.storeUrl}</p>
        {copied ? <Alert className="mt-4" title="Link copiado" variant="success" /> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={shareStore}><Share2 aria-hidden="true" />Compartilhar minha loja</Button>
          <Button onClick={copyLink} variant="secondary"><Copy aria-hidden="true" />Copiar link</Button>
          <a className={buttonVariants({ variant: "secondary" })} href={`https://wa.me/?text=${encodeURIComponent(`Conheça o catálogo da ${props.storeName}: ${props.storeUrl}`)}`} onClick={markShared} rel="noreferrer" target="_blank"><MessageCircle aria-hidden="true" className="size-4" />WhatsApp</a>
          <Button onClick={showQrCode} variant="secondary"><QrCode aria-hidden="true" />QR Code</Button>
        </div>
      </Card>

      <dialog aria-describedby="store-qr-description" aria-labelledby="store-qr-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }} ref={dialogRef}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold" id="store-qr-title">QR Code da loja</h2><p className="mt-1 text-sm text-[var(--app-foreground-muted)]" id="store-qr-description">Aponte a câmera para abrir o catálogo.</p></div><Button aria-label="Fechar QR Code" onClick={() => dialogRef.current?.close()} size="icon" variant="ghost"><X aria-hidden="true" /></Button></div>
          {qrDataUrl ? <Image alt={`QR Code para ${props.storeName}`} className="mx-auto mt-5 aspect-square w-full max-w-72" height={288} src={qrDataUrl} unoptimized width={288} /> : null}
          {qrDataUrl ? <a className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white" download={`qr-code-${props.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`} href={qrDataUrl}><Download aria-hidden="true" className="size-4" />Baixar QR Code</a> : null}
        </div>
      </dialog>
    </div>
  );
}
