"use client";

import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { trackProductMetric } from "@/lib/analytics/client";

type StoreShareButtonProps = {
  analyticsSlug?: string;
  description: string | null;
  storeName: string;
  url: string;
};

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("clipboard_unavailable");
}

export function StoreShareButton({ analyticsSlug, description, storeName, url }: StoreShareButtonProps) {
  const notify = useToast();

  async function shareStore() {
    const shareData = {
      text: description ?? `Confira a loja ${storeName}.`,
      title: storeName,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        if (analyticsSlug) trackProductMetric("catalog_shared", analyticsSlug);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await copyToClipboard(url);
      if (analyticsSlug) trackProductMetric("catalog_shared", analyticsSlug);
      notify({ title: "Link copiado", variant: "success" });
    } catch {
      notify({ title: "Não foi possível copiar o link", variant: "danger" });
    }
  }

  return (
    <Button
      aria-label={`Compartilhar a loja ${storeName}`}
      className="px-3 @xl:px-4"
      onClick={shareStore}
      variant="themeSecondary"
    >
      <Share2 aria-hidden="true" />
      <span className="hidden min-[375px]:inline">Compartilhar</span>
    </Button>
  );
}
