import { getLegalIdentity } from "@/lib/legal/identity";

export function LegalIdentityDetails() {
  const identity = getLegalIdentity();

  if (!identity.complete) {
    return (
      <div
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        data-legal-identity="incomplete"
        role="status"
      >
        <p className="font-semibold !text-amber-950">Identificação do fornecedor pendente</p>
        <p className="mt-1 !text-amber-900">
          Esta instalação ainda precisa configurar a identificação legal e o canal oficial de atendimento antes de receber clientes reais.
        </p>
      </div>
    );
  }

  return (
    <address
      className="grid gap-1 not-italic"
      data-legal-identity="complete"
    >
      <p><strong className="text-[var(--app-foreground)]">Responsável:</strong> {identity.businessName}</p>
      <p><strong className="text-[var(--app-foreground)]">CPF/CNPJ:</strong> {identity.taxId}</p>
      <p><strong className="text-[var(--app-foreground)]">Endereço:</strong> {identity.address}</p>
      <p>
        <strong className="text-[var(--app-foreground)]">Atendimento:</strong>{" "}
        <a className="font-semibold text-brand-700 underline underline-offset-4" href={`mailto:${identity.supportEmail}`}>
          {identity.supportEmail}
        </a>
      </p>
    </address>
  );
}
