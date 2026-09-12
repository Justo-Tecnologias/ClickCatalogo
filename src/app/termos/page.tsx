import type { Metadata } from "next";

import { LegalIdentityDetails } from "@/components/marketing/legal-identity";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  alternates: { canonical: "/termos" },
  title: "Termos de uso",
};

export default function TermsPage() {
  return (
    <LegalPage
      description="Regras essenciais para usar a plataforma ClickCatálogo e manter seu catálogo publicado."
      title="Termos de uso"
      updatedAt="10 de setembro de 2026"
    >
      <section>
        <h2>1. O serviço</h2>
        <p>O ClickCatálogo oferece uma ferramenta para criar e administrar catálogos digitais com direcionamento de pedidos ao WhatsApp. O lojista é responsável pelo conteúdo, pelos preços, pelo atendimento e pelas vendas realizadas.</p>
      </section>
      <section>
        <h2>2. Identificação e atendimento</h2>
        <LegalIdentityDetails />
      </section>
      <section>
        <h2>3. Conta e acesso</h2>
        <p>O acesso ao painel é pessoal e protegido pelo e-mail da assinatura e pela senha do usuário. Cada conta administra uma loja. O usuário deve fornecer dados corretos, manter seu acesso seguro e comunicar qualquer suspeita de uso indevido.</p>
      </section>
      <section>
        <h2>4. Assinatura, renovação e cancelamento</h2>
        <p>O plano custa R$ 27 por mês e é renovado de forma recorrente pelo Asaas. Atrasos podem limitar o serviço. O cancelamento pode ser solicitado no painel e interrompe as cobranças futuras; loja e painel permanecem disponíveis até o fim do período já pago, indicado antes da confirmação. Encerrado esse período, a loja fica offline e começa o prazo operacional de retenção de até 30 dias. O titular pode antecipar a exclusão para até 15 dias na área de privacidade. Evidências mínimas podem ser preservadas conforme a Política de Privacidade. Cancelar a renovação não gera reembolso automático; valores já pagos e pedidos de reembolso são analisados conforme a legislação aplicável e as condições da cobrança.</p>
      </section>
      <section>
        <h2>5. Arrependimento e suporte</h2>
        <p>Quando o direito de arrependimento previsto na legislação brasileira for aplicável, a solicitação poderá ser feita pelo canal de atendimento informado neste documento. O pedido deve identificar a conta e a cobrança para permitir a verificação segura.</p>
      </section>
      <section>
        <h2>6. Pedidos e vendas dos lojistas</h2>
        <p>O ClickCatálogo organiza os itens escolhidos e abre o WhatsApp do lojista. A negociação, disponibilidade, entrega, cobrança do pedido e atendimento ao consumidor são realizados diretamente entre lojista e cliente. O ClickCatálogo não recebe o valor das vendas exibidas nos catálogos.</p>
      </section>
      <section>
        <h2>7. Conteúdo e uso aceitável</h2>
        <p>Não é permitido publicar conteúdo ilegal, enganoso, que viole direitos de terceiros, introduza código malicioso ou tente comprometer a segurança da plataforma. Conteúdos e contas podem ser suspensos para proteger o serviço, seus usuários e terceiros.</p>
      </section>
      <section>
        <h2>8. Disponibilidade e alterações</h2>
        <p>Trabalhamos para manter a plataforma disponível, mas manutenções e serviços de terceiros podem causar interrupções. Mudanças relevantes nestes termos serão informadas pelos meios disponíveis e não afastam direitos garantidos pela legislação brasileira.</p>
      </section>
    </LegalPage>
  );
}
