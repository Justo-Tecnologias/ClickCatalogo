import type { Metadata } from "next";

import { LegalIdentityDetails } from "@/components/marketing/legal-identity";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  alternates: { canonical: "/privacidade" },
  title: "Política de privacidade",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      description="Como o ClickCatálogo trata os dados necessários à criação, cobrança e operação da sua loja."
      title="Política de privacidade"
    >
      <section>
        <h2>1. Controlador e contato</h2>
        <LegalIdentityDetails />
      </section>
      <section>
        <h2>2. Dados tratados</h2>
        <p>Tratamos nome da loja, WhatsApp, e-mail, endereço público escolhido, credenciais protegidas pelo Supabase Auth e dados inseridos no catálogo. Também registramos informações técnicas mínimas de segurança, intenções de cadastro e eventos de pagamento. Os dados completos de cartão são processados pelo Asaas e não são armazenados pelo ClickCatálogo.</p>
      </section>
      <section>
        <h2>3. Dados publicados pelo lojista</h2>
        <p>Nome, descrição, logo, banner, WhatsApp, Instagram, endereço e produtos cadastrados pelo lojista podem aparecer publicamente no endereço da loja. O lojista deve publicar apenas informações que esteja autorizado a divulgar.</p>
      </section>
      <section>
        <h2>4. Finalidades e bases</h2>
        <p>Usamos os dados para executar o serviço contratado, publicar a loja, processar a assinatura, autenticar e recuperar o acesso, atender solicitações, prevenir abuso, proteger direitos e cumprir obrigações legais ou regulatórias. Quando necessário, outro fundamento previsto na legislação ou o consentimento do titular será utilizado.</p>
      </section>
      <section>
        <h2>5. Fornecedores e transferências</h2>
        <p>Usamos Netlify para hospedagem, Supabase para banco de dados, autenticação e imagens, Asaas para cobrança e Resend como SMTP dos e-mails de autenticação. Esses fornecedores podem processar dados em infraestrutura fora do Brasil e devem tratá-los conforme seus contratos, medidas de segurança e a legislação aplicável.</p>
      </section>
      <section>
        <h2>6. Cookies e carrinho</h2>
        <p>Usamos cookies essenciais para manter a sessão, selecionar a loja administrada e proteger a demonstração. O carrinho do catálogo permanece somente na memória da página e é descartado quando ela é recarregada. Não usamos cookies de publicidade comportamental ou ferramentas de análise na versão atual.</p>
      </section>
      <section>
        <h2>7. Retenção e segurança</h2>
        <p>Enquanto a assinatura estiver ativa, inclusive durante o período já pago após o cancelamento da próxima renovação, mantemos os dados necessários para prestar o serviço. Quando esse período termina, a loja fica indisponível e catálogo, produtos, imagens, configurações e acesso permanecem por até 30 dias para encerramento operacional. O titular autenticado pode antecipar esse prazo para até 15 dias na tela Privacidade do painel.</p>
        <p>Intenções de cadastro canceladas ou expiradas são eliminadas depois de 90 dias. Payloads de webhooks processados com sucesso são mantidos por 180 dias; falhas pendentes ficam preservadas até serem resolvidas. Registros técnicos de limitação de abuso expiram em um dia.</p>
        <p>Depois da exclusão operacional, preservamos por cinco anos, contados do arquivamento, somente evidências mínimas de contratação, aceite dos documentos e pagamento, sem conteúdo do catálogo, imagens, WhatsApp, endereço ou credenciais. Esse conjunto isolado existe para obrigações legais, prevenção de fraude e exercício regular de direitos. Ao fim do prazo, ele também é eliminado. Aplicamos isolamento entre lojas, controle de acesso, validação de origem, limitação de abuso e chaves exclusivas de servidor.</p>
      </section>
      <section>
        <h2>8. Direitos do titular</h2>
        <p>O titular pode solicitar confirmação do tratamento, acesso, correção, informação sobre compartilhamento, portabilidade, oposição, revogação de consentimento ou eliminação quando aplicável. A antecipação da exclusão operacional pode ser solicitada no próprio painel após o cancelamento. Os demais pedidos devem ser enviados ao canal indicado nesta política e podem exigir confirmação pelo e-mail cadastrado para proteger a conta.</p>
      </section>
      <section>
        <h2>9. Atualizações</h2>
        <p>Esta política pode ser atualizada para refletir mudanças no serviço, nos fornecedores ou na legislação. A data da versão vigente aparece no início do documento.</p>
      </section>
    </LegalPage>
  );
}
