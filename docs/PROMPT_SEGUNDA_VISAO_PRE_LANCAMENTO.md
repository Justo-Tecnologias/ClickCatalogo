# ClickCatálogo — pedido de segunda visão técnica antes do lançamento

Copie todo o conteúdo deste documento e envie ao ChatGPT ou a outro revisor.
Não anexe `.env.local`, chaves, tokens, payloads reais, documentos pessoais ou
dados identificáveis de clientes.

---

Atue como um revisor independente formado pelas seguintes especialidades:

- engenharia sênior de SaaS multi-tenant;
- Next.js App Router executado na Netlify;
- Supabase Postgres, Auth, Storage e RLS;
- integrações financeiras e webhooks do Asaas;
- segurança de aplicações web e prevenção de abuso;
- operação de micro-SaaS e experiência de onboarding;
- privacidade e práticas relacionadas à LGPD.

Quero uma segunda visão crítica sobre a prontidão do **ClickCatálogo** para um
lançamento controlado com os primeiros clientes reais. Não quero elogios
genéricos nem uma lista infinita de melhorias. Procure riscos concretos,
classifique-os pela gravidade e diferencie bloqueadores de lançamento de
evoluções que podem esperar.

## 1. Produto

O ClickCatálogo é um SaaS brasileiro para pequenos lojistas criarem uma loja
pública e receberem pedidos organizados pelo WhatsApp. O sistema não recebe o
pagamento das mercadorias do lojista e não confirma a conclusão da venda.

Modelo atual:

- domínio: `https://clickcatalogo.com`;
- plano único: R$ 27 por mês;
- cobrança recorrente por cartão no Asaas;
- uma loja por usuário/e-mail;
- seis temas visuais;
- categorias e produtos;
- logo e banner;
- carrinho no navegador e envio consolidado pelo WhatsApp;
- demonstração separada e sem operações financeiras reais.

## 2. Arquitetura

- Next.js 16.3.3 com App Router;
- React 19 e TypeScript;
- Tailwind CSS e componentes próprios;
- Netlify para deploy e Functions;
- Supabase Postgres, Auth e Storage;
- RLS para isolamento entre tenants;
- bucket público `produtos`, com escrita limitada à pasta do tenant;
- Asaas para checkout e recorrência;
- Resend para e-mails transacionais e SMTP do Supabase Auth;
- Zod para validação de payloads;
- ISR de 60 segundos no catálogo público;
- `next/image` para produto, logo e banner.

Segredos de Supabase, Asaas e Resend ficam somente no servidor/ambiente da
Netlify. `.env.local` está ignorado pelo Git.

## 3. Fluxo de cadastro e recuperação

1. O usuário informa nome da loja, WhatsApp, e-mail e slug.
2. E-mail e slug são validados antes da escolha do tema.
3. O backend cria uma `signup_intent` antes de abrir o checkout.
4. O checkout hospedado pelo Asaas recebe uma `externalReference` UUID.
5. Somente o webhook do Asaas confirma o pagamento.
6. O webhook cria ou encontra o usuário do Supabase Auth, cria o tenant e
   vincula a assinatura.
7. A tela de sucesso permite definir a senha inicial.

Continuidade já implementada:

- cookie HTTP-only para retomar no mesmo navegador;
- `/cadastro/continuar` para voltar à intenção;
- `/cadastro/recuperar` para outro navegador ou dispositivo;
- recuperação por e-mail com resposta não enumerável;
- token aleatório de 256 bits e uso único, válido por 20 minutos;
- somente o hash do token é persistido;
- token bruto via fragmento da URL, fora do log HTTP;
- link intermediário resistente a scanners/prefetch;
- checkout pendente ainda válido é reutilizado em vez de duplicado;
- o mesmo e-mail não pode comprar uma segunda loja.

## 4. Assinatura, cancelamento e reativação

O cancelamento self-service exige o nome exato da loja. O fluxo atual:

1. lista as cobranças da assinatura e calcula o fim do período pago a partir da
   cobrança liquidada mais recente acrescida de um ciclo mensal;
2. registra localmente esse corte sem depender de `subscription.nextDueDate`;
3. altera a assinatura remota para `INACTIVE`;
4. lista as cobranças já geradas pela assinatura;
5. seleciona somente cobranças com status exatamente `PENDING`, pertencentes à
   assinatura correta e vencimento igual ou posterior ao fim do período pago;
6. remove individualmente somente essas cobranças;
7. lista novamente todas as cobranças e só conclui quando nenhuma permanece
   igual ou posterior ao corte;
8. persiste `pending`, `complete` ou `attention` como estado da conciliação;
9. tenta novamente estados pendentes/atenção pela rotina horária;
10. mantém loja e painel ativos até o fim do período pago.

O sistema nunca tenta excluir cobrança `CONFIRMED`, `RECEIVED`, `OVERDUE` ou
anterior à data de corte. Resposta 404 ao repetir a exclusão é tratada como
idempotente. Falhas de rede e respostas inválidas deixam o estado em
`attention`.

O painel só afirma “Não haverá nova cobrança” quando a conciliação está
`complete`. Caso contrário, mostra “Em conferência”, permite tentar novamente e
bloqueia uma nova contratação até a situação anterior ser esclarecida.

Antes do fim do período pago, o titular pode desfazer o cancelamento. A
recorrência volta para `ACTIVE` com a próxima data correta, sem cobrar novamente
o período atual. Depois do fim do acesso, uma nova contratação reativa o mesmo
tenant em vez de criar outra loja.

## 5. Webhook do Asaas

Endpoint: `POST /api/webhooks/asaas`.

Proteções e comportamento:

- valida o header `asaas-access-token` antes do payload;
- comparação de segredo resistente a diferenças de tempo;
- schema Zod;
- cada `event.id` é persistido;
- claim atômico no Postgres;
- lease para recuperar execução interrompida;
- reentrega já concluída não duplica tenant ou assinatura;
- processamento concorrente recente retorna erro recuperável;
- eventos financeiros antigos não reabrem tenant terminalmente cancelado;
- logs estruturados incluem duração, request ID, event ID, tipo e resultado;
- logs não recebem payload completo, senha, token, chave, e-mail ou WhatsApp.

Eventos configurados no webhook de Produção:

- `CHECKOUT_PAID`;
- `CHECKOUT_CANCELED`;
- `CHECKOUT_EXPIRED`;
- `PAYMENT_CONFIRMED`;
- `PAYMENT_DELETED`;
- `PAYMENT_RECEIVED`;
- `PAYMENT_OVERDUE`;
- `SUBSCRIPTION_DELETED`;
- `SUBSCRIPTION_INACTIVATED`;
- `SUBSCRIPTION_UPDATED`.

O processamento ainda é síncrono antes do HTTP 200. Não existe fila externa.
Isso foi aceito para o volume inicial, mantendo persistência e reentrega do
Asaas como proteção.

## 6. Rate limiting e segurança

O limitador usa uma RPC atômica no Supabase e HMAC do identificador/IP; o IP
bruto não é armazenado.

- checkout, definição de senha e recuperação de cadastro falham fechados com
  HTTP 503 se o limitador distribuído estiver indisponível;
- webhook e rotas leves mantêm fallback local para não perder eventos críticos;
- checkout e criação inicial de senha validam origem;
- Server Actions autenticadas derivam o tenant da sessão, sem aceitar tenant ID
  arbitrário do navegador;
- uploads validam tamanho, MIME, assinatura binária, dimensões, pixels,
  animação e decodificação;
- headers incluem CSP, `nosniff`, proteção contra iframe, política de referência
  e restrições de permissões;
- slugs, IDs do Asaas e intenções possuem constraints/índices de unicidade;
- há rotinas de retenção, exclusão e evidência legal mínima.

Foi criado um teste SQL adversarial que assume a identidade do usuário A e
tenta ler/alterar a loja B, suas categorias, produtos, assinatura, RPC de
reordenação e pasta do Storage. O script executa dentro de uma transação e faz
`rollback`.

## 7. Privacidade e aspectos operacionais

- Termos e Política de Privacidade possuem versões independentes;
- o aceite e a versão vigente são gravados na intenção de cadastro;
- a política informa Netlify, Supabase, Asaas e Resend;
- informa o uso de e-mail transacional e recuperação do cadastro;
- informa métricas agregadas diárias sem IP, telefone, e-mail ou conteúdo do
  catálogo;
- métricas agregadas podem ser mantidas por até 400 dias;
- pedidos do consumidor não são persistidos pelo ClickCatálogo;
- dados operacionais de conta cancelada possuem prazo de retenção;
- dados legais mínimos são isolados do conteúdo operacional;
- nome legal, documento, endereço postal e canal de atendimento são variáveis
  de ambiente e estão cadastrados na Netlify;
- o endereço legal foi corrigido no ambiente antes deste pedido de revisão.

Uma revisão jurídica profissional ainda não foi realizada.

## 8. Banco e migrations

As migrations são incrementais e não destrutivas. As últimas são:

- `202609100011_launch_recovery_and_reactivation.sql`;
- `202609100012_first_party_product_metrics.sql`;
- `202609120013_cancellation_payment_reconciliation.sql`.

Segundo a operação realizada antes desta revisão:

- as três migrations foram executadas com sucesso;
- `supabase/verify-setup.sql` foi executado;
- o teste crítico de claim/idempotência/rate limit foi executado;
- o teste adversarial multi-tenant foi executado quando existiam duas lojas;
- os eventos adicionais `PAYMENT_DELETED` e `SUBSCRIPTION_UPDATED` foram
  cadastrados no webhook.

Trate essas afirmações como evidência operacional informada pelo responsável,
não como prova automática do código.

## 9. Qualidade verificada localmente

No lote atual:

- ESLint aprovado;
- TypeScript aprovado;
- contraste AA aprovado nos seis temas;
- 20 testes automatizados aprovados;
- build de Produção aprovado;
- 27 páginas/rotas compiladas;
- `npm audit --omit=dev` retornou zero vulnerabilidades conhecidas;
- `git diff --check` aprovado;
- varredura não encontrou segredos com formato real em arquivos versionáveis;
- Termos e Privacidade responderam HTTP 200 no build local;
- CSP foi confirmada na resposta local.

Os testes automatizados cobrem contratos do checkout, estados de assinatura,
seleção segura de cobranças pendentes, moeda, tokens de recuperação,
invariantes do schema, política fail-closed e requisitos do webhook. Eles não
fazem cobrança real nem substituem um E2E financeiro em Produção.

## 10. Pendências e limites conhecidos

- primeira cobrança real controlada do lote final ainda precisa ser observada;
- cancelamento, conciliação e reversão precisam de teste real controlado;
- recuperação deve ser validada também no Outlook;
- não existe painel administrativo global;
- não existe troca de cartão, reembolso automatizado, upgrade ou downgrade;
- não há fila externa para webhook;
- planos gratuitos possuem limites de disponibilidade e uso;
- revisão jurídica profissional permanece recomendada;
- Google Login, Analytics/Meta Pixel, vitrine de lojas, página detalhada de
  produto, blog/ajuda, trial e integração com Instagram são evoluções futuras.

## 11. O que quero que você avalie

Responda obrigatoriamente às perguntas abaixo:

1. Existe alguma transição concreta ainda não coberta que possa perder um
   pagamento, duplicar uma loja/assinatura ou cobrar depois do cancelamento?
2. A seleção e remoção somente de cobranças futuras `PENDING` está correta e
   conservadora? Existe um caso financeiro que exija proteção adicional?
3. O comportamento diante de interrupção entre banco, API do Asaas e webhook é
   seguro ou pode produzir uma promessa falsa no painel?
4. Há risco de IDOR ou vazamento entre tenants não coberto pelas RLS e pelo
   teste adversarial descrito?
5. A recuperação cross-device permite enumeração, replay ou vazamento relevante?
6. O fail-closed escolhido para checkout/senha/recuperação e o fallback do
   webhook são decisões proporcionais para o MVP?
7. A Política de Privacidade ainda contém alguma afirmação incompatível com o
   funcionamento descrito?
8. Quais testes manuais são indispensáveis antes do primeiro cliente real?
9. Qual é o parecer final: **GO**, **GO com monitoramento** ou **NO-GO**?

## 12. Formato exigido da resposta

Entregue:

1. parecer executivo em até 10 linhas;
2. tabela de achados com severidade `P0`, `P1`, `P2` ou `P3`;
3. para cada achado: evidência usada, cenário de falha, impacto, correção mínima
   e teste de confirmação;
4. checklist manual em ordem exata para o primeiro teste real;
5. itens que podem esperar validação comercial;
6. decisão final de lançamento.

Não trate possibilidades abstratas como bugs confirmados. Quando faltar código
ou evidência, escreva “precisa ser confirmado” e diga exatamente qual arquivo,
consulta, log ou configuração deve ser verificado. Não recomende mudança de
stack, Redis pago, microsserviços, Kubernetes ou fila externa sem demonstrar um
risco concreto incompatível com o volume inicial.

---

Arquivos que podem ser enviados junto, sem segredos, se o revisor pedir:

- `docs/RELEASE_LANCAMENTO.md`;
- `docs/RESUMO_AUDITORIA_POS_RELEASE.md`;
- `STATUS.md`;
- `SETUP.md`;
- `supabase/schema.sql`;
- `supabase/migrations/202609120013_cancellation_payment_reconciliation.sql`;
- `supabase/test-multitenant-isolation.sql`;
- `src/lib/asaas/client.ts`;
- `src/lib/asaas/payments.ts`;
- `src/app/api/webhooks/asaas/route.ts`;
- `src/app/painel/(app)/assinatura/actions.ts`;
- `src/lib/security/rate-limit.ts`;
- arquivos da pasta `tests/`.
