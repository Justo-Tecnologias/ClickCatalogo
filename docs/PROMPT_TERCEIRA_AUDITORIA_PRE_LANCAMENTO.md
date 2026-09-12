# Prompt — terceira auditoria independente pré-lançamento do ClickCatálogo

Você é um engenheiro de software sênior especializado em SaaS multi-tenant,
Next.js, Supabase, Netlify, integrações financeiras com Asaas, segurança de
aplicações e confiabilidade operacional.

Faça uma auditoria independente e adversarial do estado atual do ClickCatálogo.
Não presuma que uma implementação está correta somente porque ela está descrita
como concluída. Procure contradições, condições de corrida, estados impossíveis,
falhas parciais e promessas incorretas ao usuário.

O objetivo não é adicionar funcionalidades comerciais nem redesenhar o produto.
O objetivo é decidir se esta release pode receber os primeiros clientes pagantes
com segurança e quais correções mínimas ainda são obrigatórias.

## 1. Contexto do produto

O ClickCatálogo é um SaaS brasileiro para pequenos lojistas criarem um catálogo
público e receberem pedidos consolidados pelo WhatsApp.

- plano mensal de R$ 27;
- assinatura recorrente no cartão processada pelo Asaas;
- o ClickCatálogo não processa o pagamento dos produtos vendidos pelo lojista;
- Next.js 16.3.3 com App Router e Server Actions;
- React 19 e TypeScript;
- Supabase Postgres, Auth, Storage e RLS;
- Netlify com Next.js e Scheduled Function;
- Resend para e-mails transacionais;
- catálogo público com ISR, `next/image`, temas e Open Graph dinâmico;
- painel autenticado para loja, categorias, produtos, assinatura e privacidade.

Produção prevista: `https://clickcatalogo.com`.

## 2. Alterações realizadas depois da auditoria anterior

### 2.1 Cancelamento e período pago

A auditoria anterior identificou que `subscription.nextDueDate` não era uma
fonte segura para definir o corte do cancelamento, pois pode avançar depois que
a cobrança do próximo ciclo já foi gerada.

O fluxo foi alterado para:

1. listar as cobranças vinculadas à assinatura;
2. selecionar a cobrança liquidada com `dueDate` mais recente;
3. reconhecer como liquidados os estados `CONFIRMED`, `RECEIVED`,
   `RECEIVED_IN_CASH` e `DUNNING_RECEIVED`;
4. calcular o fim do período pago adicionando um ciclo mensal à `dueDate` dessa
   cobrança, incluindo ajuste para o último dia de fevereiro e meses curtos;
5. interromper o cancelamento sem alterar a assinatura se não existir cobrança
   liquidada suficiente para determinar o período com segurança;
6. salvar esse corte em `access_until` e `next_due_date`;
7. alterar a recorrência remota para `INACTIVE`;
8. listar e excluir somente cobranças `PENDING` da assinatura correta cuja
   `dueDate` seja igual ou posterior ao corte;
9. listar novamente todas as cobranças da assinatura;
10. gravar `complete` somente quando nenhuma cobrança permanecer igual ou
    posterior ao corte;
11. gravar `attention` diante de falha, resposta ambígua, cobrança remanescente
    ou corrida de status;
12. o painel só mostra “Não haverá nova cobrança” quando o estado é `complete`.

Uma cobrança que mudar de `PENDING` para `CONFIRMED` entre o primeiro `GET` e o
`DELETE` não é apagada nem considerada sucesso: a releitura final deve deixá-la
em `attention` para resolução manual.

### 2.2 Recuperação automática de conciliações

A Scheduled Function
`netlify/functions/finalize-subscription-cancellations.mjs` executa de hora em
hora e agora:

1. busca até dez assinaturas com conciliação `pending` ou `attention`;
2. tenta novamente colocar a recorrência em `INACTIVE`;
3. remove somente cobranças futuras ainda `PENDING`;
4. relê as cobranças para validar a pós-condição;
5. grava `complete` ou mantém `attention`;
6. não escreve IDs de cobrança, dados pessoais ou payloads nos logs;
7. depois chama a RPC de finalização de acessos vencidos.

A migration incremental
`202609120014_require_reconciliation_before_finalization.sql` altera a RPC
`finalize_due_subscription_cancellations` para finalizar somente registros com:

```sql
cancel_at_period_end = true
and cancellation_reconciliation_status = 'complete'
and access_until <= now()
```

Assim, o vencimento da data não deve esconder uma conciliação ainda pendente.

### 2.3 Recuperação e segurança

- o token de retomada de cadastro tem 256 bits, expira em 20 minutos, é de uso
  único e somente o hash é persistido;
- o token bruto é transportado no fragmento da URL;
- depois de capturado no navegador, o fragmento é removido imediatamente com
  `history.replaceState`;
- criação da senha exige cookie de retomada, referência da intenção paga,
  tenant provisionado e usuário proprietário correspondente;
- consumo do token usa RPC atômica;
- ações mutáveis do painel derivam o tenant da sessão e restringem consultas e
  alterações a esse tenant;
- checkout, criação de senha e recuperação usam rate limiting distribuído e
  falham fechados quando a proteção não está disponível;
- o IP bruto não é persistido pelo limitador: é usado um HMAC derivado, com
  expiração de até um dia;
- a Política de Privacidade passou a descrever esse processamento transitório.

### 2.4 Webhook e observabilidade

- token do webhook validado antes do payload;
- `event.id` persistido para idempotência;
- claim atômico e lease para retomar processamento interrompido;
- evento concorrente recebe resposta recuperável, não falso sucesso;
- duração do processamento registrada em log estruturado;
- payload financeiro, e-mail, WhatsApp, token e segredos não devem ir para logs;
- eventos de checkout, pagamentos e assinatura são processados;
- `PAYMENT_DELETED` e `SUBSCRIPTION_UPDATED` estão no checklist da auditoria;
- o fluxo real já persistiu `asaas_subscription_id` a partir dos eventos de
  checkout/pagamento, por isso `SUBSCRIPTION_CREATED` não foi tornado uma
  dependência obrigatória;
- o webhook continua síncrono antes do HTTP 200 no volume inicial.

## 3. Evidências locais já obtidas

- ESLint aprovado;
- TypeScript aprovado;
- contraste AA aprovado nos seis temas;
- 29 de 29 testes automatizados aprovados;
- build Next.js aprovado, com 27 páginas/rotas;
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas;
- `git diff --check`: sem erro;
- varredura local: nenhuma chave real versionada;
- migrations 011, 012 e 013 informadas como aplicadas no Supabase;
- migration 014 criada e informada como executada, mas a confirmação específica
  esperada é `finalizacao_exige_conciliacao_completa = true`;
- o resultado `allowed = true` recebido da RPC de rate limit confirma apenas o
  limitador distribuído e não prova, sozinho, a migration 014.

Não trate os testes locais como substitutos do teste real com Asaas, Netlify,
Supabase Auth/RLS e duas contas distintas.

## 4. Arquivos prioritários para inspeção

Analise, no mínimo:

- `src/lib/asaas/payments.ts`;
- `src/lib/asaas/client.ts`;
- `src/lib/asaas/contracts.ts`;
- `src/app/painel/(app)/assinatura/actions.ts`;
- `src/app/painel/(app)/assinatura/page.tsx`;
- `src/components/painel/subscription-cancellation.tsx`;
- `src/app/api/webhooks/asaas/route.ts`;
- `netlify/functions/finalize-subscription-cancellations.mjs`;
- `supabase/schema.sql`;
- `supabase/migrations/202609100011_launch_recovery_and_reactivation.sql`;
- `supabase/migrations/202609120013_cancellation_payment_reconciliation.sql`;
- `supabase/migrations/202609120014_require_reconciliation_before_finalization.sql`;
- `supabase/verify-setup.sql`;
- `src/app/api/cadastro/definir-senha/route.ts`;
- `src/app/api/cadastro/recuperar/route.ts`;
- `src/app/api/cadastro/recuperar/confirmar/route.ts`;
- `src/components/cadastro/signup-recovery-confirmation.tsx`;
- `src/components/painel/recovery-link-confirmation.tsx`;
- `src/lib/security/rate-limit.ts`;
- `src/app/privacidade/page.tsx`;
- `src/lib/legal/documents.ts`;
- `tests/asaas-payments.test.ts`;
- `tests/tenant-boundaries.test.ts`;
- `tests/database-invariants.test.ts`;
- `tests/webhook-security.test.ts`;
- `supabase/test-launch-critical.sql`;
- `supabase/test-multitenant-isolation.sql`;
- `SETUP.md`;
- `docs/RELEASE_LANCAMENTO.md`;
- `docs/RETORNO_AUDITORIA_FINAL.md`.

## 5. Perguntas obrigatórias da auditoria

### 5.1 Corte financeiro

1. Usar a última cobrança liquidada mais um ciclo mensal é correto para o
   contrato mensal atual do Checkout Asaas?
2. Os quatro estados tratados como liquidados são apropriados para conceder o
   período de acesso?
3. Existe algum estado pago, estornado, chargeback ou análise de risco que
   deveria alterar o cálculo ou a pós-condição?
4. O ajuste de fim do mês pode antecipar ou estender acesso indevidamente?
5. Há risco de uma cobrança de outra assinatura/tenant entrar no cálculo quando
   o endpoint do Asaas não inclui o campo `subscription` em cada item?

### 5.2 Falhas parciais e corridas

Analise cada interrupção possível:

```text
DB grava pending
→ Asaas muda para INACTIVE
→ cobranças PENDING são listadas
→ DELETE é executado
→ lista final é consultada
→ DB grava complete
→ no vencimento, tenant é finalizado
```

Para cada transição, diga qual estado fica no Asaas e no Supabase se houver
timeout, 404, 409, 429, 500, queda da Function, resposta inválida ou mudança
concorrente de `PENDING` para outro status.

Confirme especialmente:

- se algum caminho ainda grava `complete` sem provar a pós-condição;
- se um 404 de assinatura ou cobrança pode produzir falso sucesso;
- se a rotina horária pode finalizar o tenant apesar de uma conciliação falhar;
- se duas execuções simultâneas da Scheduled Function podem causar dano;
- se dez itens por hora podem gerar starvation;
- se o retry horário precisa de lease/claim próprio;
- se uma cobrança paga durante a corrida exige estorno, extensão de acesso ou
  somente atendimento manual.

### 5.3 Desfazer cancelamento e renovação

- Confirme que `ACTIVE` com `nextDueDate = access_until` não cobra novamente o
  período já pago.
- Verifique corrida entre “Desfazer cancelamento”, Scheduled Function, webhook e
  finalização do tenant.
- Confirme que `pending`/`attention` bloqueiam checkout de reativação sem
  impedir injustamente uma correção operacional.
- Verifique se um estado remoto `deleted` ainda pode possuir cobranças geradas e
  se o comportamento conservador atual é adequado.

### 5.4 Webhook

- Determine pelo código de onde vem o `asaas_subscription_id` em cada ordem
  possível de eventos.
- Diga objetivamente se `SUBSCRIPTION_CREATED` é necessário, redundância útil ou
  dispensável no fluxo atual.
- Confirme que reentrega e concorrência nunca duplicam usuário, tenant,
  assinatura ou intenção.
- Avalie se o processamento síncrono ainda é aceitável para os primeiros
  clientes e defina um limite mensurável para migrar a uma fila.

### 5.5 Multi-tenancy e service role

- Procure IDOR em toda rota/Server Action que usa `service_role`.
- Verifique se IDs enviados pelo navegador podem atingir tenant, produto,
  categoria, assinatura, Storage, recuperação ou exclusão de outra conta.
- Diferencie garantias reais de RLS, verificações no backend e testes meramente
  estáticos.
- Proponha somente os testes de integração mínimos que ainda faltam.

### 5.6 Recuperação e privacidade

- Confirme que o token sai da URL antes que código de terceiros possa lê-lo.
- Procure enumeração de e-mail, replay, prefetch, brute force, vazamento em log,
  Referer, histórico, analytics e mensagens de erro.
- Compare o comportamento real de IP/HMAC, métricas e retenção com a Política de
  Privacidade.
- Aponte apenas inconsistências concretas; não faça revisão jurídica genérica.

### 5.7 Operação Netlify

- Confirme que a Scheduled Function recebe todas as variáveis necessárias.
- Verifique detecção segura de Sandbox/Produção pela chave Asaas e
  `ASAAS_API_URL` para chaves legadas.
- Avalie limites de duração, retries, concorrência e observabilidade da Function.
- Diga como detectar rapidamente uma conciliação presa sem criar agora um
  painel administrativo completo.

## 6. O que não deve ser proposto como bloqueador sem evidência

Não transforme estas evoluções comerciais em impedimento técnico:

- alteração de slug;
- vitrine pública de lojas;
- página individual de produto;
- blog ou central de ajuda;
- Google Login;
- Analytics ou Meta Pixel;
- integração com Instagram;
- trial gratuito;
- upgrade/downgrade;
- troca de cartão dentro do painel;
- painel financeiro avançado;
- fila externa, Redis ou nova infraestrutura sem demonstrar necessidade atual.

## 7. Formato obrigatório da resposta

Entregue:

1. parecer executivo: `GO`, `GO COM MONITORAMENTO` ou `NO-GO`;
2. tabela de achados com severidade `P0`, `P1`, `P2` ou `P3`;
3. para cada achado: arquivo/trecho, cenário de falha, impacto, correção mínima e
   teste de confirmação;
4. revisão explícita do algoritmo de corte financeiro;
5. matriz das falhas parciais do cancelamento;
6. decisão objetiva sobre `SUBSCRIPTION_CREATED`;
7. riscos reais de service role/IDOR;
8. checklist manual, em ordem exata, para o único deploy e teste controlado;
9. lista separada do que pode esperar validação comercial;
10. decisão final curta e sem linguagem promocional.

Não aceite como prova frases como “funcionou aqui”. Baseie a conclusão no código,
nas migrations, nos testes e, quando necessário, na documentação oficial atual
do Asaas, Supabase, Next.js e Netlify. Diferencie claramente bug confirmado,
risco plausível, melhoria opcional e teste ainda pendente.
