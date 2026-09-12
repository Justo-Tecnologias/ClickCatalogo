# Setup atual — Supabase, Netlify e Asaas

Este é o guia principal para colocar o **ClickCatálogo** em um ambiente novo. Ele considera o estado atual do código: Next.js com App Router, banco e Auth no Supabase, deploy na Netlify e cobrança recorrente pelo Asaas.

## Antes de começar

- Não envie chaves secretas por chat e não as grave no Git.
- O arquivo local com valores reais é `C:\Projeto-Github\ClickCatálogo\.env.local`.
- A Netlify não usa o `.env.local` do computador durante o deploy. Cadastre as variáveis no painel dela.
- O ambiente atual já usa o novo Supabase e `https://clickcatalogo.com` na Netlify.
- Em uma instalação paralela, use a URL própria `*.netlify.app` até vincular um domínio.

## 1. Ordem recomendada

1. Executar o schema consolidado no novo Supabase.
2. Em um banco já criado com uma versão anterior, executar somente a migration complementar indicada abaixo.
3. Executar a verificação somente leitura.
4. Copiar URL, Publishable key e Secret key do Supabase.
5. Configurar Auth e URLs de redirecionamento.
6. Verificar o domínio no Resend e conectar o SMTP ao Supabase Auth.
7. Preencher `.env.local` para testar localmente.
8. Conectar o repositório GitHub à Netlify.
9. Cadastrar as variáveis na Netlify e publicar o site.
10. Atualizar a URL do Auth com o domínio da Netlify.
11. Configurar Asaas e webhook.
12. Validar recuperação de senha, cadastro, pagamento, painel, uploads, catálogo e cancelamento.

## 2. Banco de dados completo

Para um projeto Supabase novo e vazio, execute somente este arquivo:

`C:\Projeto-Github\ClickCatálogo\supabase\schema.sql`

Passos:

1. Abra o novo projeto no Supabase.
2. Acesse **SQL Editor → New query**.
3. Abra o arquivo `schema.sql`, copie todo o conteúdo e cole no editor.
4. Clique em **Run**.
5. O resultado deve terminar sem erro.

Não execute também as migrations individuais. O `schema.sql` já consolida todas elas na ordem correta.

### Banco criado antes da correção de slugs expirados

Se o `schema.sql` foi executado antes de **29 de agosto de 2026**, rode agora somente este arquivo no SQL Editor:

`C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608280005_expire_stale_signup_intents.sql`

Ele adiciona uma função restrita à `service_role` e libera reservas pendentes vencidas mesmo quando o webhook `CHECKOUT_EXPIRED` não chega. O arquivo é idempotente e não recria tabelas, bucket ou policies.

### Banco já criado antes da auditoria pré-lançamento

Se o `schema.sql` já foi executado, rode agora, depois da migration anterior:

`C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608290006_prelaunch_hardening.sql`

Ela adiciona:

- uma única loja por usuário, compatível com o painel atual;
- consulta administrativa para bloquear uma segunda compra com o mesmo e-mail;
- reordenação atômica de categorias;
- rate limiting compartilhado entre todas as Functions da Netlify, armazenando somente HMAC do IP.

Essa migration precisa estar aplicada **antes** do deploy do código desta rodada.

### Correção complementar do rate limiting distribuído

Em bancos que já receberam a migration de hardening, execute também:

`C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608300007_fix_distributed_rate_limit.sql`

Ela corrige uma colisão entre o nome de variável `current_time` e a palavra reservada do PostgreSQL. Sem essa correção, webhook e rotas leves usam somente fallback em memória, enquanto checkout, senha inicial e recuperação ficam temporariamente indisponíveis por segurança. O arquivo termina com uma chamada real que deve retornar `allowed = true` e `remaining = 1`.

Depois, execute a migration que versiona os aceites legais:

`C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608300008_legal_acceptance_versions.sql`

Ela preserva os aceites antigos como versão `2026-08-29` e prepara novos checkouts para gravar a versão `2026-08-30`. O resultado final deve mostrar `terms_without_version = 0` e `privacy_without_version = 0`.

Por fim, execute a migration de retenção e exclusão auditável:

`C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608300009_privacy_retention_and_deletion.sql`

Ela registra `tenants.canceled_at`, cria a fila de exclusão e a área isolada de evidências legais mínimas, além das funções administrativas usadas pela rotina de expurgo. A migration não exclui dados ao ser aplicada.

Depois execute a migration de continuidade do pré-lançamento:

`C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609100010_prelaunch_continuity.sql`

Ela mantém a loja ativa até o fim do período já pago quando a próxima renovação é cancelada, cria a RPC idempotente de encerramento e adiciona uma proteção no catálogo caso a rotina agendada atrase. Esta migration precisa estar aplicada antes do deploy desta versão.

Depois, execute estas três migrations desta release, na ordem:

1. `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609100011_launch_recovery_and_reactivation.sql`
2. `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609100012_first_party_product_metrics.sql`
3. `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609120013_cancellation_payment_reconciliation.sql`
4. `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609120014_require_reconciliation_before_finalization.sql`
5. `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609120015_claim_cancellation_reconciliation.sql`

A primeira cria a recuperação cross-device por token de uso único, a retomada do checkout existente e os estados necessários para cancelamento reversível/reativação sem duplicar tenant. A segunda cria somente contadores diários agregados, sem armazenar eventos individuais ou PII. A terceira registra se cobranças futuras já geradas foram conciliadas após interromper a recorrência. A quarta impede a finalização local enquanto essa conciliação não estiver concluída. A quinta adiciona claim/lease para impedir disputa entre o agendador, outra execução e a reativação do titular. Todas são incrementais e não excluem dados existentes. Aplique-as antes de publicar o código desta release.

Depois das migrations, execute `C:\Projeto-Github\ClickCatálogo\supabase\test-launch-critical.sql`. Com pelo menos um tenant existente, o teste simula claim concorrente do webhook, reserva exclusiva da conciliação, dez reentregas do mesmo evento e consumo de rate limit dentro de uma transação revertida; não cria cobrança nem deixa dados de teste. Quando houver duas lojas de usuários diferentes na base, execute também `C:\Projeto-Github\ClickCatálogo\supabase\test-multitenant-isolation.sql`; ele tenta acessar e alterar a segunda loja como o primeiro usuário e reverte tudo ao final.

### O que o schema cria

- `public.tenants` — lojas e seus proprietários;
- `public.categories` — categorias isoladas por tenant;
- `public.products` — produtos e vínculo seguro com a categoria do mesmo tenant;
- `public.subscriptions` — assinatura e IDs do Asaas;
- `public.signup_intents` — cadastro antes da confirmação do pagamento;
- `public.asaas_webhook_events` — idempotência e auditoria de webhooks;
- `public.api_rate_limits` — limitação de abuso compartilhada entre instâncias;
- `public.signup_recovery_tokens` — hashes de tokens de retomada, com expiração e consumo atômico;
- `public.product_metrics_daily` — contadores diários agregados sem PII;
- `public.account_deletion_requests` — fila, tentativas e estado das exclusões;
- `public.legal_retention_records` — evidências mínimas isoladas do conteúdo operacional;
- constraints, índices e gatilhos de `updated_at`;
- RLS e grants para isolamento multi-tenant;
- RPCs `get_public_catalog` e `get_public_store_status` para a loja pública;
- RPC administrativa `expire_stale_signup_intents` para liberar reservas vencidas;
- RPCs protegidas para verificar conta existente, reordenar categorias e consumir rate limit;
- RPCs protegidas para arquivar evidências, agendar, reservar e expurgar dados vencidos;
- RPC protegida `finalize_due_subscription_cancellations`, executada de hora em hora pela Scheduled Function da Netlify;
- bucket público `produtos`, limite de 2 MB e tipos JPEG, PNG e WebP;
- policies de Storage que restringem escrita ao proprietário do tenant.

O bucket `produtos` é criado pelo próprio SQL. Não o crie manualmente.

### Verificar a instalação

Depois do schema, execute no SQL Editor:

`C:\Projeto-Github\ClickCatálogo\supabase\verify-setup.sql`

Esse arquivo não altera dados. Ele deve listar:

- onze tabelas inspecionadas com RLS ativo;
- dezenove funções esperadas, incluindo expiração, reordenação, rate limit, webhook atômico, retenção e claim de conciliação;
- o bucket `produtos` como público;
- policies das tabelas e do Storage.

O último resultado do arquivo executa a função de rate limiting dentro de uma transação revertida. Ele deve retornar `allowed = true` sem deixar dados de teste.

## 3. O que copiar do Supabase

No projeto, abra **Connect** ou **Settings → API Keys**.

| Valor no Supabase | Variável do projeto | Exposição |
|---|---|---|
| Project URL, formato `https://PROJECT_REF.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` | Pública |
| Publishable key, formato `sb_publishable_...` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública |
| Secret key, formato `sb_secret_...` | `SUPABASE_SERVICE_ROLE_KEY` | Segredo de servidor |

Os nomes `ANON_KEY` e `SERVICE_ROLE_KEY` foram mantidos por compatibilidade interna, mas aceitam as chaves modernas Publishable e Secret. Prefira essas chaves novas; não é necessário usar as chaves JWT legadas `anon` e `service_role`.

A Secret key ignora RLS. Cadastre-a apenas no `.env.local` e na Netlify, marcada como segredo. Nunca use prefixo `NEXT_PUBLIC_` nela.

Não é necessário copiar a senha do banco, connection string, JWT secret ou Project ID para este projeto.

## 4. Configurar Supabase Auth

Em **Authentication → Providers**, confirme que o provedor de e-mail e senha está habilitado.

Em **Authentication → URL Configuration**:

- durante o teste publicado, defina **Site URL** como `https://SEU-SITE.netlify.app`;
- adicione `https://SEU-SITE.netlify.app/auth/callback` em **Redirect URLs**;
- mantenha `http://localhost:3000/auth/callback` para desenvolvimento local;
- quando o domínio final entrar no ar, troque a Site URL para `https://clickcatalogo.com`;
- adicione `https://clickcatalogo.com/auth/callback` e também a URL exata usada pela recuperação: `https://clickcatalogo.com/auth/callback?next=%2Fpainel%2Fnova-senha`.

Se a URL completa da recuperação não estiver permitida, o Supabase pode ignorar o `redirectTo` e devolver o parâmetro `code` na raiz do site. Nesse caso a sessão não é trocada e o usuário volta para a landing em vez de abrir a criação de senha.

O pagamento não depende de e-mail: o webhook cria o usuário e a tela de sucesso permite definir a senha inicial. Porém a recuperação de senha depende de entrega de e-mail.

Antes de vender para clientes reais, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**. O SMTP padrão do Supabase é apenas para testes, restringe destinatários e tem limite baixo.

### Resend recomendado para o lançamento

O ClickCatálogo usa o Resend de duas formas: como SMTP do Supabase Auth para recuperação de senha e pela API direta para a jornada **Recuperar meu cadastro**. A API direta envia um link de uso único, com token bruto apenas no fragmento da URL; o banco recebe somente o hash.

1. No Resend, abra **Domains → Add Domain**.
2. Cadastre o subdomínio `auth.clickcatalogo.com`. O subdomínio separa a reputação dos e-mails de autenticação de futuras campanhas de marketing.
3. No painel DNS que controla `clickcatalogo.com`, crie exatamente os registros SPF, DKIM e MX exibidos pelo Resend. Adicione também o DMARC recomendado.
4. Volte ao Resend e clique em **Verify DNS Records**. Só avance quando o domínio aparecer como `Verified`.
5. Desative rastreamento de abertura e de links nesse domínio de autenticação. Links de recuperação são de uso único e não devem ser reescritos por rastreadores.
6. No Resend, abra **API Keys → Create API Key**. Use o nome `Supabase Auth — ClickCatálogo`, permissão somente de envio e restrinja ao domínio `auth.clickcatalogo.com`. Copie a chave quando ela for exibida; o Resend não mostra o valor novamente.
7. No Supabase, abra **Authentication → Notifications → Email → SMTP Settings** e habilite o SMTP personalizado.
8. Preencha os campos com os valores abaixo e salve:

```text
Host: smtp.resend.com
Porta: 465
Usuário: resend
Senha: API Key criada no passo anterior
Remetente: nao-responda@auth.clickcatalogo.com
Nome: ClickCatálogo
```

Não registre essa API Key no Git. Ela fica somente no campo de senha SMTP do Supabase. Para a retomada de cadastro, crie outra chave com permissão somente de envio e domínio restrito, e salve-a como `RESEND_API_KEY` somente em `.env.local` e na Netlify. Configure `RESEND_FROM_EMAIL` com um remetente do mesmo domínio verificado.

### Canal público de atendimento

O endereço público do serviço é `contato@clickcatalogo.com`. Ele é independente do SMTP de autenticação:

- o ImprovMX recebe as mensagens destinadas a `contato@clickcatalogo.com` e as encaminha para uma caixa privada;
- o domínio raiz `clickcatalogo.com`, verificado separadamente no Resend, permite enviar como `ClickCatálogo <contato@clickcatalogo.com>`;
- a chave restrita criada para esse envio manual não é usada pelo código atual e, portanto, não deve ser colocada na Netlify nem em `.env.local`;
- `auth.clickcatalogo.com` continua reservado aos e-mails automáticos enviados pelo Supabase Auth.

O teste de envio deve aparecer como assinado por `clickcatalogo.com`; o subdomínio técnico `rsend.clickcatalogo.com` em “enviado por” é esperado. A chave deve permanecer somente no Resend e em um gerenciador de senhas confiável.

Em **Authentication → Email Templates → Reset password**, use o template versionado abaixo. Ele mantém a confirmação fornecida pelo Supabase dentro de uma etapa intermediária do ClickCatálogo: scanners de segurança podem abrir o primeiro link sem consumir o token de uso único, que só é enviado ao Supabase depois que o usuário pressiona **Continuar e criar nova senha**. Depois envie uma recuperação real para um Gmail e um Outlook e confirme recebimento, etapa intermediária, abertura do callback, troca da senha e novo login.

O modelo em português pronto para colar está em:

`C:\Projeto-Github\ClickCatálogo\docs\supabase-email-templates\recovery.html`

O assunto recomendado e o passo a passo ficam no `README.md` da mesma pasta.

Referências oficiais: [SMTP do Resend](https://resend.com/docs/send-with-smtp), [domínios no Resend](https://resend.com/docs/dashboard/domains/introduction) e [SMTP do Supabase Auth](https://supabase.com/docs/guides/auth/auth-smtp).

## 5. Variáveis locais

Edite:

`C:\Projeto-Github\ClickCatálogo\.env.local`

Use este formato:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=

DEMO_ACCESS_ENABLED=true

LEGAL_BUSINESS_NAME=
LEGAL_TAX_ID=
LEGAL_POSTAL_ADDRESS=
LEGAL_SUPPORT_EMAIL=

SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=ClickCatálogo <contato@clickcatalogo.com>

ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_API_URL=
```

Gere `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` uma única vez com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` e use exatamente o mesmo valor no ambiente local e na Netlify. A chave mantém as Server Actions compatíveis entre instâncias e publicações; não a envie por chat nem a versione.

Para validar banco, login e CRUD localmente, as três variáveis do Supabase são suficientes. Para o cadastro pago também são necessárias `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`, além de uma URL HTTPS pública. Antes da primeira venda, preencha as quatro variáveis `LEGAL_*` com a identificação e o canal reais do fornecedor; esses valores aparecem publicamente e não devem ser fictícios.

Teste local:

```powershell
cd C:\Projeto-Github\ClickCatálogo
node --version
npm install
npm run verify
npm run dev
```

O comando deve mostrar Node.js 22 ou superior. A versão atual do cliente Supabase depende do WebSocket nativo disponível nessas versões. Depois abra `http://localhost:3000`.

## 6. Deploy na Netlify

O arquivo abaixo já deixa o build versionado:

`C:\Projeto-Github\ClickCatálogo\netlify.toml`

Ele configura:

- build: `npm run verify` (qualidade, contraste e build antes de publicar);
- publish directory: `.next`;
- Node.js 22;
- proteção contra incompatibilidade entre deploys ativos.

A Netlify detecta Next.js e aplica automaticamente o adaptador OpenNext. Não instale nem fixe `@netlify/plugin-nextjs`.

### Conectar o repositório

1. Na Netlify, abra **Add new project → Import an existing project**.
2. Escolha GitHub e selecione `Leo-Labs-Rp/ClickCatalogo`.
3. Production branch: `master`.
4. Base directory: raiz do repositório, sem subpasta.
5. Confirme `npm run verify` e `.next` — o `netlify.toml` já fornece os valores.
6. Copie a URL principal exibida pela Netlify, por exemplo `https://nome-do-site.netlify.app`.

### Variáveis obrigatórias na Netlify

Abra **Project configuration → Environment variables** e cadastre para o contexto de Produção:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
DEMO_ACCESS_ENABLED
LEGAL_BUSINESS_NAME
LEGAL_TAX_ID
LEGAL_POSTAL_ADDRESS
LEGAL_SUPPORT_EMAIL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
```

No ambiente publicado, use `NEXT_PUBLIC_SITE_URL=https://clickcatalogo.com`, com `https://` e sem barra final. Para uma instalação de teste separada, use a URL própria `*.netlify.app` desse ambiente.

O endereço não fica mais fixo no `netlify.toml`: o valor do painel da Netlify é a fonte única. Quando o domínio final entrar no ar, basta trocar a variável e publicar novamente.

Marque como segredo:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `RESEND_API_KEY`;
- `ASAAS_API_KEY`;
- `ASAAS_WEBHOOK_TOKEN`;
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

As variáveis `LEGAL_*` não são credenciais: elas serão publicadas nos documentos legais. Ainda assim, mantê-las no painel da Netlify evita gravar CPF/CNPJ ou endereço pessoal no repositório público.

`ASAAS_API_URL` deve permanecer ausente ou vazia com chaves atuais. O código escolhe Sandbox ou Produção pelo prefixo da chave.

Depois de criar ou alterar variáveis, faça um novo deploy. As variáveis `NEXT_PUBLIC_*` são incorporadas durante o build e não mudam em deploys antigos. Acumule alterações e publique em lote para evitar consumo desnecessário de créditos.

Em contas Netlify Free novas, confirme também que o projeto foi publicado e não ficou privado.

### Conferir a rotina de fim de assinatura

O arquivo `C:\Projeto-Github\ClickCatálogo\netlify\functions\finalize-subscription-cancellations.mjs` é publicado como Scheduled Function e executa de hora em hora. Antes de finalizar acessos vencidos, ele usa `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY` e, somente para chave legada, `ASAAS_API_URL` no servidor para tentar novamente conciliações `pending`/`attention`. Cada item é reservado atomicamente pela RPC da migration 015, passa a `processing` e não pode disputar com a reativação do titular. A rotina respeita orçamento interno de 17 segundos, inativa a recorrência, remove apenas cobranças `PENDING` a partir do fim do período pago, relê todas as cobranças e só grava `complete` quando nenhuma permanece após o corte. O log final informa duração, contagens e idade da pendência mais antiga, sem PII.

Depois do deploy de Produção:

1. abra **Netlify → Project overview → Functions**;
2. localize `finalize-subscription-cancellations` e confirme o selo **Scheduled**;
3. abra a função e use **Run now** uma vez;
4. confira no log um objeto `reconciliation` com contadores e `finalized` igual
   a `0` ou outro número inteiro, sem erro de autenticação. O log não inclui IDs
   de cobrança nem dados pessoais.

A rotina agendada só executa automaticamente em deploy publicado. O catálogo possui uma segunda proteção no banco e deixa de exibir uma loja vencida mesmo se essa execução atrasar.

## 7. Asaas

### Valores necessários

- `ASAAS_API_KEY`: gerada na conta Asaas correta;
- `ASAAS_WEBHOOK_TOKEN`: segredo aleatório criado por você e repetido exatamente na Netlify e no webhook.

Chaves `$aact_hmlg_...` usam Sandbox. Chaves `$aact_prod_...` usam Produção. Não é necessária mudança de código.

### Webhook

Depois do primeiro deploy público, crie no painel do Asaas:

```text
Nome: ClickCatálogo
URL: https://clickcatalogo.com/api/webhooks/asaas
Token: mesmo valor de ASAAS_WEBHOOK_TOKEN
API: v3
Envio: sequencial
Webhook ativo: sim
Fila de sincronização: ativa
```

No campo **Tipo de envio**, selecione explicitamente **SEQUENTIALLY
(sequencial)**. Isso reduz eventos de assinatura fora de ordem; o handler também
mantém proteções contra reentrega e eventos antigos.

Ative estes eventos:

```text
CHECKOUT_PAID
CHECKOUT_CANCELED
CHECKOUT_EXPIRED
PAYMENT_CONFIRMED
PAYMENT_DELETED
PAYMENT_RECEIVED
PAYMENT_OVERDUE
SUBSCRIPTION_DELETED
SUBSCRIPTION_INACTIVATED
SUBSCRIPTION_UPDATED
```

O checkout custa R$ 27 por mês e atualmente usa cartão de crédito recorrente. Pix recorrente não faz parte deste fluxo.

O valor do checkout é definido no código pelo plano oficial de R$ 27. A versão de lançamento não aceita variável de ambiente para reduzir o preço, evitando que uma configuração de teste esquecida gere assinaturas com valor incorreto.

## 8. Tenant manual para testar sem Asaas

1. Em **Authentication → Users**, crie um usuário com e-mail e senha e copie o UUID dele.
2. No SQL Editor, execute substituindo o UUID, slug, nome e WhatsApp:

```sql
with nova_loja as (
  insert into public.tenants (
    slug,
    nome_loja,
    whatsapp,
    owner_user_id,
    status,
    tema
  ) values (
    'loja-teste',
    'Loja Teste',
    '5511999999999',
    'UUID_DO_USUARIO_AUTH'::uuid,
    'ativo',
    'natural'
  )
  returning id
)
insert into public.subscriptions (tenant_id, valor, status)
select id, 27.00, 'ativo'
from nova_loja;
```

Depois entre em `/painel` com o e-mail e a senha desse usuário. Categorias, produtos, uploads e loja pública usarão dados reais do novo Supabase.

## 9. Teste de ponta a ponta

1. Abra `/cadastro` no domínio da Netlify.
2. Use um slug novo e um e-mail que ainda não exista no novo Supabase.
3. Conclua o checkout no ambiente escolhido do Asaas.
4. Aguarde `/cadastro/sucesso?ref=...` confirmar o webhook.
5. Crie a senha inicial na própria tela.
6. Confirme no Supabase:
   - usuário em **Authentication → Users**;
   - `signup_intents.status = 'pago'`;
   - tenant com `status = 'ativo'`;
   - assinatura ativa com IDs do Asaas;
   - eventos com `processed_at` preenchido e `processing_error` vazio.
7. Entre no painel, crie categoria e produto, envie uma imagem e abra `/loja/SLUG`.
8. Teste pedido individual e carrinho consolidado pelo WhatsApp.
9. No Sandbox, escolha uma assinatura descartável e valide o cancelamento self-service.

Depois dos testes funcionais, rode as auditorias repetíveis:

```powershell
# Exige Node.js 22 ou superior e valida banco, RLS, Storage e integridade.
npm run audit:live

# Valida domínio, páginas, headers, proteção do painel e catálogo publicado.
npm run audit:production -- loja-teste-netlify
```

O produto atual aceita **uma loja por e-mail/usuário**. Uma segunda tentativa retorna orientação para entrar no painel ou recuperar a senha, antes de abrir outro checkout.

## 10. Domínio final `clickcatalogo.com`

O domínio já está vinculado à Netlify. Para uma instalação nova ou migração futura:

1. Configure o domínio e aguarde SSL ativo.
2. Troque `NEXT_PUBLIC_SITE_URL` para `https://clickcatalogo.com` na Netlify.
3. Faça novo deploy.
4. Troque a Site URL do Supabase Auth e adicione o callback final.
5. Troque a URL do webhook do Asaas para `https://clickcatalogo.com/api/webhooks/asaas`.
6. Teste login, recuperação, checkout e webhook novamente.

## 11. O que está pronto e o que ainda bloqueia venda real

### Pronto no código

- landing, cadastro em duas etapas e checkout;
- webhook idempotente e provisionamento automático;
- login por senha e definição inicial de senha sem depender de e-mail;
- CRUD de loja, categorias e produtos;
- uploads protegidos por tenant;
- catálogo público com busca, paginação, temas e otimização de imagens;
- carrinho client-side e pedido consolidado pelo WhatsApp;
- assinatura e cancelamento self-service;
- área de privacidade, solicitação antecipada e rotina segura de exclusão;
- termos e política de privacidade.

### Obrigatório antes do primeiro cliente real

- executar, na ordem, as migrations `202608300007`, `202608300008` e `202608300009` no banco que já recebeu o hardening;
- colar e testar o template em português de recuperação;
- identificar o fornecedor do serviço e publicar um canal de atendimento real nos termos e na política de privacidade;
- configurar webhook na conta Asaas de Produção;
- realizar uma cobrança real controlada e um cancelamento controlado;
- revisar logs da Netlify, Supabase e Asaas após o teste.

### Limites do gratuito

- Netlify Free possui limite mensal rígido; ao esgotá-lo, os projetos podem pausar até o próximo ciclo ou upgrade.
- Projetos Supabase Free podem pausar por baixa atividade e não oferecem a mesma garantia operacional de um plano de Produção.
- O gratuito é adequado para validação e lançamento pequeno, mas deve haver monitoramento e plano de upgrade antes de depender da plataforma para receita recorrente.

## 12. Mapa de arquivos

- schema completo: `C:\Projeto-Github\ClickCatálogo\supabase\schema.sql`;
- migration complementar de slugs expirados: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608280005_expire_stale_signup_intents.sql`;
- hardening pré-lançamento: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608290006_prelaunch_hardening.sql`;
- correção do rate limiting distribuído: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608300007_fix_distributed_rate_limit.sql`;
- versionamento dos aceites legais: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608300008_legal_acceptance_versions.sql`;
- retenção e exclusão auditável: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202608300009_privacy_retention_and_deletion.sql`;
- continuidade de cancelamento: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609100010_prelaunch_continuity.sql`;
- recuperação e reativação: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609100011_launch_recovery_and_reactivation.sql`;
- métricas agregadas sem PII: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609100012_first_party_product_metrics.sql`;
- conciliação de cobranças após cancelamento: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609120013_cancellation_payment_reconciliation.sql`;
- bloqueio da finalização antes da conciliação: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609120014_require_reconciliation_before_finalization.sql`;
- claim exclusivo da conciliação: `C:\Projeto-Github\ClickCatálogo\supabase\migrations\202609120015_claim_cancellation_reconciliation.sql`;
- template de recuperação: `C:\Projeto-Github\ClickCatálogo\docs\supabase-email-templates\recovery.html`;
- verificação do banco: `C:\Projeto-Github\ClickCatálogo\supabase\verify-setup.sql`;
- teste de integração crítico sem cobrança: `C:\Projeto-Github\ClickCatálogo\supabase\test-launch-critical.sql`;
- teste adversarial entre duas lojas: `C:\Projeto-Github\ClickCatálogo\supabase\test-multitenant-isolation.sql`;
- exemplo de variáveis: `C:\Projeto-Github\ClickCatálogo\.env.example`;
- valores locais reais: `C:\Projeto-Github\ClickCatálogo\.env.local`;
- configuração Netlify: `C:\Projeto-Github\ClickCatálogo\netlify.toml`;
- auditoria do ambiente publicado: `C:\Projeto-Github\ClickCatálogo\scripts\audit-production.mjs`;
- expurgo de retenção em modo seguro: `C:\Projeto-Github\ClickCatálogo\scripts\purge-retention.mjs`;
- rotina de publicação, monitoramento, backup e incidentes: `C:\Projeto-Github\ClickCatálogo\docs\OPERACAO.md`;
- estado e pendências: `C:\Projeto-Github\ClickCatálogo\STATUS.md`.
