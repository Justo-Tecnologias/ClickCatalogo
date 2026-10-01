"use client";

import { ChevronRight, Eye, KeyRound, LifeBuoy, LoaderCircle, MailCheck, Store } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useFormStatus } from "react-dom";

// Ícones por nome: componentes não atravessam a fronteira servidor → cliente.
const ICONS = {
  ajuda: LifeBuoy,
  criar: Store,
  demonstracao: Eye,
  link: MailCheck,
  senha: KeyRound,
} as const;

type AccessOptionContent = {
  description: string;
  icon: keyof typeof ICONS;
  title: string;
};

const OPTION_CLASS = "group flex w-full items-center gap-3 rounded-[var(--radius-card)] border bg-white p-4 text-left shadow-sm outline-none transition-[border-color,box-shadow] hover:border-brand-600 hover:shadow-[var(--shadow-elevation)] focus-visible:ring-3 focus-visible:ring-brand-200 disabled:cursor-wait has-[[data-pending=true]]:pointer-events-none";

function OptionBody({ description, icon, pending, title }: AccessOptionContent & { pending: boolean }) {
  const Icon = ICONS[icon];
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
        {pending ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" data-pending="true" /> : <Icon aria-hidden="true" className="size-5" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold text-brand-900">{title}</span>
        <span className="text-xs leading-5 text-[var(--app-foreground-muted)]">{description}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[var(--app-foreground-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
    </>
  );
}

function LinkOptionBody(props: AccessOptionContent) {
  const { pending } = useLinkStatus();
  return <OptionBody {...props} pending={pending} />;
}

/** Opção de acesso em formato de cartão que leva a outra página. */
export function AccessOptionLink({ href, ...content }: AccessOptionContent & { href: string }) {
  return (
    <Link className={OPTION_CLASS} href={href}>
      <LinkOptionBody {...content} />
    </Link>
  );
}

/** Mesma aparência, como botão de envio de um formulário (server action). */
export function AccessOptionSubmit({ pendingTitle, ...content }: AccessOptionContent & { pendingTitle: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={OPTION_CLASS} disabled={pending} type="submit">
      <OptionBody {...content} pending={pending} title={pending ? pendingTitle : content.title} />
    </button>
  );
}
