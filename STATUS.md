# Status atual do ClickCatálogo

Relatório consolidado em **12 de agosto de 2026** e revisado em **12 de setembro de 2026** para o pré-lançamento em `clickcatalogo.com`.

## Como o estado foi verificado

- código da branch `master`, partindo do commit publicado `df1aaba` e incluindo as alterações locais desta rodada;
- schema consolidado e migrations versionadas em `supabase/`;
- OpenAPI do projeto Supabase real, consultado em modo somente leitura para confirmar colunas, tipos, obrigatoriedade, defaults e relacionamentos expostos;
- dados agregados do Supabase real, sem registrar e-mails, IDs ou chaves neste arquivo;
- respostas HTTP e inspeção visual do deploy ativo, incluindo landing, cadastro, painel, catálogo, imagens e carrinho;
- validação funcional e responsiva local em 375 px, 768 px e 1440 px;
- `npm run check`, `npm run build` e conferência de diff executados no estado final.

## Resumo executivo

O sistema está **operacional de ponta a ponta no fluxo já validado**: cadastro, checkout recorrente, webhook, provisionamento do usuário/tenant/assinatura, criação inicial de senha, recuperação self-service, painel com dados reais, uploads e catálogo público. A configuração de Produção é selecionada pela chave do ambiente; a primeira cobrança real e o cancelamento controlado continuam sendo testes obrigatórios depois desta release.

O **Modo Carrinho está implementado na loja pública**, 100% client-side e sem persistência. O cliente pode adicionar produtos, alterar quantidades, revisar o pedido em um painel acessível e enviar um pedido consolidado pelo WhatsApp. O pedido individual de cada `ProductCard` foi preservado.

O **cancelamento self-service foi corrigido** em `/painel/assinatura`: exige digitar exatamente o nome da loja, deriva o fim do período pago da próxima cobrança já gerada ou do `nextDueDate` autoritativo quando ela ainda não existe, inativa a recorrência no Asaas, remove somente cobranças futuras ainda pendentes a partir desse corte e relê a lista antes de concluir. Somente cobranças de cartão em `CONFIRMED`/`RECEIVED` comprovam pagamento. O banco registra o resultado, o painel não promete ausência de cobrança quando a conferência falha e a rotina horária repete estados pendentes/atenção mesmo sem retorno do titular. Claim atômico, estado `processing`, lease e gravações condicionais serializam o agendador contra “Desfazer cancelamento”. Durante o período pago o titular pode desfazer o cancelamento sem nova cobrança. Assinaturas legadas já removidas no Asaas usam um checkout de reativação vinculado ao tenant existente, sem criar outra loja ou outro usuário.

A **retomada cross-device do cadastro** está implementada localmente em `/cadastro/recuperar`: resposta não enumerável, rate limit por IP e HMAC do e-mail, token aleatório de uso único com 20 minutos, somente hash no banco e envio pela API do Resend. Checkout ainda válido é reutilizado; pagamento continua confirmado exclusivamente pelo webhook.

A **retenção e exclusão auditável estão implementadas e preparadas no Supabase**: `tenants.canceled_at`, fila com reserva atômica e retentativas, evidência legal mínima isolada, tela do titular e executor em modo simulação por padrão. A migration `202608300009_privacy_retention_and_deletion.sql` foi aplicada e passou na auditoria live; nenhum expurgo real foi executado durante o desenvolvimento.

As categorias receberam refinamento visual de pills, títulos, indicador lateral e separação entre seções. Por decisão de produto, **não há contadores nas categorias**.

## 1. Rotas implementadas

### Páginas

| Rota | Estado | Integração real e comportamento atual |
|---|---|---|
| `/` | Implementada | Landing estática funcional. Links para cadastro, painel, temas, termos e privacidade. A prévia de temas reutiliza o catálogo real de componentes, mas usa dados de demonstração. |
| `/cadastro` | Implementada | Formulário em duas etapas, validação com Zod, consulta real de slug, preview com os dados digitados e abertura do checkout recorrente do Asaas no ambiente selecionado pela chave. |
| `/cadastro/sucesso?ref=...` | Implementada | Consulta a intenção real a cada 2 segundos, mostra a loja provisionada, seleciona o tenant correspondente ao pagamento, permite configurar a senha uma única vez e tenta entrar automaticamente no painel. |
| `/cadastro/recuperar` | Implementada localmente | Envia instruções genéricas pelo Resend e permite retomar com segurança em outro navegador/dispositivo. |
| `/cadastro/recuperar/confirmar` | Implementada localmente | Consome explicitamente um token de uso único mantido no fragmento da URL e restaura o cookie HTTP-only de retomada. |
| `/painel` | Implementada | Login real por e-mail e senha via Supabase Auth, link de recuperação e demonstração separada/somente leitura quando `DEMO_ACCESS_ENABLED` não é `false`. |
| `/painel/recuperar-senha` | Implementada e testada | Solicita recuperação pelo Supabase Auth sem revelar se o e-mail possui conta. SMTP Resend, recebimento, callback e troca de senha foram validados; o template visual em português está versionado para aplicação manual. |
| `/painel/nova-senha` | Implementada | Exige sessão válida criada pelo link de recuperação e atualiza a senha com `supabase.auth.updateUser`. |
| `/painel/loja` | Implementada | Lê e atualiza dados reais do tenant; edita nome, descrição, WhatsApp, Instagram, endereço e tema; envia logo/banner ao Storage; comprime imagens no navegador; mostra preview reutilizando a loja pública. |
| `/painel/categorias` | Implementada | CRUD real, reordenação atômica por arrastar ou setas, bloqueio de exclusão quando existem produtos vinculados e aviso não bloqueante ao criar a 16ª categoria. |
| `/painel/produtos` | Implementada | CRUD real, upload, substituição ou remoção de imagem, compressão para WebP, ativar/ocultar e limpeza do arquivo antigo no Storage. |
| `/painel/assinatura` | Implementada localmente | Lê status e cobrança, agenda cancelamento no fim do período, permite desfazer enquanto há acesso e oferece nova contratação para recorrências legadas/depois do fim do acesso. |
| `/painel/privacidade` | Implementada localmente | Explica direitos e prazos, abre o canal de atendimento, permite antecipar a exclusão após cancelamento, exige o nome exato da loja e permite voltar ao prazo padrão enquanto o processamento não começou. |
| `/loja/[slug]` | Implementada | Catálogo real via RPC pública segura, ISR de 60 segundos, `next/image`, status ativo/inadimplente/cancelado, busca client-side, categorias, paginação de 20 produtos por categoria, pedido individual e carrinho client-side com pedido consolidado pelo WhatsApp. |
| `/termos` | Implementada | Conteúdo real, não é página vazia. |
| `/privacidade` | Implementada | Conteúdo real, não é página vazia. |
| `/auth/confirmar-recuperacao` | Implementada localmente | Etapa intermediária resistente a prefetch: preserva a confirmação no fragmento do navegador e só consome o token após um `POST` explícito do usuário. Aguarda o próximo deploy e a reaplicação do template no Supabase. |
| `/auth/callback` | Implementada e ativa | Troca o código PKCE por sessão e encaminha o usuário à tela de nova senha. Redireciona links inválidos/expirados para uma nova solicitação. |

As rotas públicas `/`, `/cadastro`, `/cadastro/sucesso`, `/painel`, `/loja/justoespetos`, `/termos` e `/privacidade` responderam HTTP `200` no deploy durante esta auditoria. Rotas protegidas do painel exigem sessão e foram validadas pelo código, Supabase real e testes anteriores do fluxo autenticado.

### APIs e ações de servidor

| Endpoint/ação | Estado | Responsabilidade |
|---|---|---|
| `GET /api/slug-disponivel` | Implementado | Valida o formato, limita a 60 consultas/min por IP e consulta `tenants` e reservas ativas em `signup_intents`. |
| `POST /api/checkout/asaas` | Implementado | Valida o cadastro, aplica limite de 5 tentativas/10 min por IP, reserva o slug, cria checkout recorrente mensal de R$ 27 e devolve a URL hospedada pelo Asaas. |
| `POST /api/webhooks/asaas` | Implementado | Aplica limite de 180 chamadas/min por IP, valida token, registra evento, evita duplicidade, provisiona ou atualiza assinatura e sincroniza status do tenant. |
| `GET /api/cadastro/status` | Implementado | Informa estado da intenção, slug e acesso; grava cookie HTTP-only do tenant pago para o painel abrir a loja correta. |
| `POST /api/cadastro/definir-senha` | Implementado | Limita a 10 tentativas/15 min por IP, confere referência, pagamento, tenant e e-mail e define senha uma única vez no Supabase Auth. |
| `POST /api/cadastro/recuperar` | Implementado localmente | Resposta genérica, limites por IP/e-mail e envio de token de uso único via Resend. |
| `POST /api/cadastro/recuperar/confirmar` | Implementado localmente | Consome hash atomicamente e restaura somente o cookie seguro da intenção correspondente. |
| `POST /api/analytics` | Implementado localmente | Recebe allowlist de eventos sem PII e incrementa apenas contadores diários agregados. |
| Server Actions de `/painel/loja` | Implementadas | Atualização do tenant e uploads de logo/banner. |
| Server Actions de `/painel/categorias` | Implementadas | Criar, editar, excluir e reordenar categorias. |
| Server Actions de `/painel/produtos` | Implementadas | Criar, editar, publicar/ocultar e excluir produtos e imagens. |
| Server Action de `/painel/assinatura` | Implementada | Confere sessão, tenant, nome digitado e assinatura; chama o Asaas no servidor e sincroniza `subscriptions.status` e `tenants.status`. |
| Server Actions de `/painel/privacidade` | Implementadas localmente | Conferem sessão, tenant, cancelamento e confirmação; usam RPCs atômicas para antecipar ou retirar a antecipação sem disputar a fila operacional. |
| Server Actions de `/painel` | Implementadas | Login por senha, início da demonstração e logout. |

### Regras atuais do catálogo público

- busca aparece apenas com mais de 12 produtos;
- filtro ocorre em memória por nome e descrição, com debounce de 300 ms;
- cada categoria mostra inicialmente até 20 produtos e oferece `Carregar mais`;
- navegação de categorias fica sticky com mais de 8 categorias ou mais de 12 produtos;
- produtos inativos não saem pela RPC pública;
- lojas ativas e inadimplentes continuam públicas sem expor a situação financeira ao comprador; lojas canceladas exibem indisponibilidade;
- imagens usam `next/image`; produto e logo usam 1:1, banner usa 21:9 com limite mobile;
- cards ocupam 100% da célula do grid responsivo, têm altura-base uniforme e ações alinhadas;
- o fallback de produto respeita as cores do tema;
- o carrinho fica apenas em memória e é limpo ao recarregar ou sair da página;
- a prévia da landing, cadastro e painel mantém os refinamentos visuais, mas não exibe o botão flutuante do carrinho.

## 2. Modelo de dados real

As colunas abaixo foram confirmadas no OpenAPI do Supabase em execução. Constraints, índices, triggers e policies foram conferidos no schema/migrations que correspondem a essas estruturas.

### `public.tenants`

| Coluna | Tipo | Nulo/default | Uso atual |
|---|---|---|---|
| `id` | `uuid` | obrigatório; `gen_random_uuid()` | PK do tenant. |
| `slug` | `text` | obrigatório; único | Endereço público `/loja/[slug]`. |
| `nome_loja` | `text` | obrigatório | Nome exibido no catálogo. |
| `logo_url` | `text` | nulo | URL pública da logo no Storage. |
| `banner_url` | `text` | nulo | URL pública do banner no Storage. |
| `descricao_curta` | `text` | nulo | Texto do cabeçalho, até 180 caracteres. |
| `whatsapp` | `text` | obrigatório | Formato real: `55 + DDD + número`, apenas dígitos. |
| `instagram` | `text` | nulo | Nome normalizado do perfil. |
| `endereco` | `text` | nulo | Endereço mostrado no rodapé. |
| `tema` | `text` | obrigatório; `minimal` | Um dos seis temas. |
| `owner_user_id` | `uuid` | obrigatório | FK para `auth.users(id)`, com `on delete restrict`. |
| `status` | `text` | obrigatório; `ativo` | `ativo`, `inadimplente` ou `cancelado`. |
| `created_at` | `timestamptz` | obrigatório; `now()` | Auditoria/ordenação. |
| `updated_at` | `timestamptz` | obrigatório; `now()` | Atualizado por trigger. |

Regras relevantes: slug minúsculo de 3–60 caracteres e sem palavras reservadas; nome de 2–100; WhatsApp `^55[0-9]{10,11}$`; índice por proprietário. RLS permite ao autenticado selecionar e atualizar somente tenants próprios; `status` e `owner_user_id` não estão na lista de colunas editáveis pelo cliente.

### `public.categories`

| Coluna | Tipo | Nulo/default | Uso atual |
|---|---|---|---|
| `id` | `uuid` | obrigatório; `gen_random_uuid()` | PK. |
| `tenant_id` | `uuid` | obrigatório | FK para `tenants(id)`, `on delete cascade`. |
| `nome` | `text` | obrigatório | Nome de 1–80 caracteres. |
| `ordem` | `integer` | obrigatório; `0` | Ordem manual, valor não negativo. |
| `created_at` | `timestamptz` | obrigatório; `now()` | Desempate de ordenação. |
| `updated_at` | `timestamptz` | obrigatório; `now()` | Atualizado por trigger. |

Regras relevantes: `(id, tenant_id)` é único para suportar a FK composta de produtos; o nome normalizado é único por tenant; índice `(tenant_id, ordem, created_at)`. RLS concede CRUD somente ao proprietário do tenant.

### `public.products`

| Coluna | Tipo | Nulo/default | Uso atual |
|---|---|---|---|
| `id` | `uuid` | obrigatório; `gen_random_uuid()` | PK. |
| `tenant_id` | `uuid` | obrigatório | FK para `tenants(id)`, `on delete cascade`. |
| `category_id` | `uuid` | obrigatório | Parte da FK composta para categoria do mesmo tenant. |
| `nome` | `text` | obrigatório | Nome de 1–120 caracteres. |
| `preco` | `numeric(10,2)` | obrigatório | Deve ser pelo menos `0.01`. |
| `descricao` | `text` | nulo | Até 1.000 caracteres. |
| `imagem_url` | `text` | nulo | URL pública no Storage. |
| `variacao_info` | `text` | nulo | Até 300 caracteres. |
| `ativo` | `boolean` | obrigatório; `true` | Controla publicação no catálogo. |
| `ordem` | `integer` | obrigatório; `0` | Ordem dentro da categoria. |
| `created_at` | `timestamptz` | obrigatório; `now()` | Desempate de ordenação. |
| `updated_at` | `timestamptz` | obrigatório; `now()` | Atualizado por trigger. |

Regras relevantes: FK `(category_id, tenant_id)` impede associar produto a categoria de outro tenant e usa `on delete restrict`; índices para ordenação e um índice parcial para produtos ativos. RLS concede CRUD somente ao proprietário.

### `public.subscriptions`

| Coluna | Tipo | Nulo/default | Uso atual |
|---|---|---|---|
| `id` | `uuid` | obrigatório; `gen_random_uuid()` | PK. |
| `tenant_id` | `uuid` | obrigatório | FK para `tenants(id)`, `on delete cascade`. |
| `asaas_customer_id` | `text` | nulo | Reconciliação alternativa por cliente Asaas. |
| `asaas_subscription_id` | `text` | nulo; único | Identificador principal da assinatura no Asaas. |
| `valor` | `numeric(10,2)` | obrigatório; `27.00` | Valor mensal; deve ser positivo. |
| `status` | `text` | obrigatório; `ativo` | `ativo`, `atrasado` ou `cancelado`. |
| `next_due_date` | `date` | nulo | Próxima cobrança recebida do Asaas. |
| `portal_url` | `text` | nulo | Hoje recebe o `invoiceUrl` disponível no evento. |
| `created_at` | `timestamptz` | obrigatório; `now()` | Auditoria. |
| `updated_at` | `timestamptz` | obrigatório; `now()` | Atualizado por trigger. |

Regras relevantes: somente uma assinatura `ativo`/`atrasado` por tenant; índice por tenant e índice de reconciliação por `asaas_customer_id`. RLS permite ao proprietário apenas leitura; gravações financeiras ficam no backend com service role.

### Colunas e estruturas de suporte incorporadas durante o desenvolvimento

Além do núcleo mínimo de catálogo, o sistema real hoje depende destes campos de implementação:

- identidade visual e contato no tenant: `logo_url`, `banner_url`, `descricao_curta`, `instagram`, `endereco`, `tema`;
- multi-tenancy e cobrança: `owner_user_id`, `status`;
- organização/publicação: `categories.ordem`, `products.ativo`, `products.ordem`, `products.variacao_info`;
- conciliação financeira: `asaas_customer_id`, `asaas_subscription_id`, `next_due_date`, `portal_url`;
- auditoria em todas as quatro tabelas: `created_at`, `updated_at`.

Duas tabelas auxiliares também existem no banco real:

- `signup_intents`: reserva os dados anteriores ao pagamento, referência externa, IDs do Asaas, expiração, status e tenant provisionado;
- `asaas_webhook_events`: guarda payload, tentativas, processamento e erro por `event_id`, formando a base da idempotência.

Também existem as funções `get_public_catalog(text)` e `get_public_store_status(text)`, ambas `security definer`, expondo somente os dados necessários ao catálogo; e o bucket público `produtos`, limitado a 2 MB por objeto e a JPEG/PNG/WebP, com escrita restrita ao proprietário pela primeira pasta `{tenant_id}/`.

## 3. Componentes reutilizáveis existentes

### Primitivos do design system

| Componente | Caminho | Papel |
|---|---|---|
| `Alert` | `src/components/ui/alert.tsx` | Estados info, sucesso, aviso e erro. |
| `Badge` | `src/components/ui/badge.tsx` | Status compactos. |
| `Button`, `buttonVariants` | `src/components/ui/button.tsx` | Botões e links com variantes da aplicação e do tema da loja. |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `src/components/ui/card.tsx` | Superfícies e composição de painéis. |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Estado vazio com ícone, descrição e ação. |
| `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | `src/components/ui/field.tsx` | Estrutura de formulários. |
| `Input` | `src/components/ui/input.tsx` | Entrada padrão de 44 px. |
| `Select` | `src/components/ui/select.tsx` | Seleção padrão. |
| `Textarea` | `src/components/ui/textarea.tsx` | Texto longo. |
| `PageHeader` | `src/components/ui/page-header.tsx` | Cabeçalho das páginas do painel. |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Carregamento visual. |
| `SubmitButton` | `src/components/ui/submit-button.tsx` | Submit integrado a `useFormStatus`. |

O painel do carrinho usa o elemento nativo `dialog`, com fechamento por botão, backdrop e evento de cancelamento, bloqueio temporário do scroll e alvos de toque de pelo menos 44 px. Não foi necessária uma biblioteca externa de modal/drawer.

### Catálogo público e preview

| Componente | Caminho | Papel |
|---|---|---|
| `StorePreview` | `src/components/loja-publica/store-preview.tsx` | Composição central compartilhada pela loja real, landing, cadastro e painel. |
| `StoreHeader` | `src/components/loja-publica/store-header.tsx` | Banner 21:9, overlay, logo, nome, descrição e CTA do WhatsApp. |
| `StoreLogo` | `src/components/loja-publica/store-logo.tsx` | Logo 1:1 com fallback. |
| `StoreCatalog` | `src/components/loja-publica/store-catalog.tsx` | Busca, debounce, paginação por categoria, estado do carrinho e composição das seções. |
| `CategoryNav` | `src/components/loja-publica/category-nav.tsx` | Pills horizontais refinadas, sem contadores, sticky condicional e navegação por âncora. |
| `ProductGrid` | `src/components/loja-publica/product-grid.tsx` | Grid responsivo de largura integral e passagem dos controles do carrinho. |
| `ProductCard` | `src/components/loja-publica/product-card.tsx` | Imagem 1:1, fallback temático, altura uniforme, pedido individual e controle de quantidade. |
| `CartPanel` | `src/components/loja-publica/cart-panel.tsx` | Drawer acessível com itens, quantidades, remoção, total e finalização pelo WhatsApp. |
| `StoreFooter` | `src/components/loja-publica/store-footer.tsx` | Endereço e Instagram. |
| `ThemePicker` | `src/components/loja-publica/theme-picker.tsx` | Escolha acessível entre os seis temas. |

### Painel, cadastro e marketing

| Componente | Caminho | Papel |
|---|---|---|
| `PanelShell` | `src/components/painel/panel-shell.tsx` | Navegação e layout do painel. |
| `StoreSettingsForm` | `src/components/painel/store-settings-form.tsx` | Configuração da loja e preview ao vivo. |
| `CategoryManager` | `src/components/painel/category-manager.tsx` | CRUD e ordenação de categorias. |
| `ProductManager` | `src/components/painel/product-manager.tsx` | CRUD/publicação de produtos. |
| `LoginForm` | `src/components/painel/login-form.tsx` | Login por senha. |
| `PasswordRecoveryRequestForm` | `src/components/painel/password-recovery-request-form.tsx` | Solicita o e-mail seguro de recuperação. |
| `PasswordResetForm` | `src/components/painel/password-reset-form.tsx` | Valida e salva a nova senha da sessão de recuperação. |
| `PasswordFields` | `src/components/painel/password-fields.tsx` | Campos compartilhados entre a criação inicial e a recuperação. |
| `SubscriptionCancellation` | `src/components/painel/subscription-cancellation.tsx` | Confirmação forte, estado de envio, erro seguro e confirmação do cancelamento. |
| `SignupForm` | `src/components/cadastro/signup-form.tsx` | Cadastro e checkout em duas etapas. |
| `SuccessStatus` | `src/components/cadastro/success-status.tsx` | Polling e resultado do pagamento. |
| `PasswordSetupForm` | `src/components/cadastro/password-setup-form.tsx` | Criação inicial da senha. |
| `ThemePreviewSection` | `src/components/marketing/theme-preview-section.tsx` | Preview interativo da landing. |
| `LegalPage` | `src/components/marketing/legal-page.tsx` | Estrutura comum de termos e privacidade. |

### Tokens e utilitários que devem ser reutilizados

- `src/styles/tokens.css`: escala de 4 px, raios, sombras, largura máxima e cores da aplicação;
- `src/styles/themes.css`: fonte única das seis paletas, inclusive `--cor-acao`, `--cor-superficie`, `--cor-borda` e `--cor-imagem-fundo`;
- `src/lib/design-system/themes.ts`: metadados dos temas;
- `src/lib/format/currency.ts`: `formatCurrency`, adequada para itens, subtotais e total do carrinho;
- `src/lib/whatsapp/url.ts`: `createWhatsAppUrl`, que já normaliza o número e codifica a mensagem;
- `src/lib/whatsapp/cart-message.ts`: composição da mensagem consolidada com quantidade, valor unitário, subtotal e total;
- `src/lib/utils/cn.ts`: composição segura de classes;
- `src/types/catalog.ts`: tipos públicos de categoria e produto.

## 4. Estado da integração com Asaas

### Implementado

- ambiente selecionado automaticamente pelo prefixo da chave; a configuração efetiva deve ser confirmada no ambiente antes de cada teste;
- chave `$aact_hmlg_` seleciona Sandbox e `$aact_prod_` seleciona Produção sem mudança de código;
- checkout hospedado via `POST /v3/checkouts`;
- assinatura `RECURRENT`, ciclo `MONTHLY`, cartão de crédito, R$ 27;
- URLs de sucesso, cancelamento e expiração apontando para o domínio público;
- webhook em `POST /api/webhooks/asaas` com comparação segura do token;
- idempotência por PK `asaas_webhook_events.event_id`;
- retomada de evento falho e proteção contra processamento concorrente recente;
- conciliação por `externalReference`, checkout session, subscription ID e customer ID;
- criação silenciosa do usuário confirmado no Supabase Auth;
- criação/reativação do tenant e upsert lógico da assinatura;
- sincronização de `ativo`, `inadimplente/atrasado` e `cancelado`;
- tratamento de `CHECKOUT_PAID`, `PAYMENT_CONFIRMED`, `PAYMENT_DELETED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`, `CHECKOUT_CANCELED` e `CHECKOUT_EXPIRED`;
- ausência das chaves retorna erro controlado, sem impedir build do projeto.
- callbacks usam `NEXT_PUBLIC_SITE_URL` e não há cliente, cartão ou URL de Sandbox fixados no fluxo de negócio.
- cancelamento self-service reversível via `PUT /v3/subscriptions/{id}` com `status: INACTIVE`, confirmação forte, corte derivado das datas autoritativas do Asaas, whitelist de cartão liquidado, conciliação de cobranças `PENDING` com releitura final, claim/lease contra reativação e acesso preservado até o fim do período pago; `SUBSCRIPTION_DELETED` permanece apenas para reconciliação de assinaturas legadas.

### Evidência do banco real em 12/08/2026

- 3 intenções de cadastro, todas `pago`, provisionadas e com checkout/assinatura identificados;
- 4 registros em `subscriptions`, todos `ativo`; 3 vieram do Asaas e 1 é o tenant manual de teste;
- 6 eventos de webhook registrados: 3 `CHECKOUT_PAID` e 3 `PAYMENT_CONFIRMED`;
- os 6 eventos estão processados sem erro atual;
- houve reentrega de evento, com máximo de 5 tentativas, sem duplicar o provisionamento — evidência prática da idempotência.

### Parcial ou não validado

- a primeira cobrança e o cancelamento controlados em Produção ainda precisam ser validados depois desta release;
- Pix não faz parte do checkout recorrente atual;
- `portal_url` recebe o `invoiceUrl` do pagamento, não um portal de assinatura confirmado;
- não há fluxo automatizado de reembolso, upgrade/downgrade ou troca de cartão dentro do ClickCatálogo;
- os webhooks de inadimplência/cancelamento estão implementados, mas a base consultada contém apenas eventos de pagamento aprovado; esses eventos negativos e o novo cancelamento self-service ainda precisam do teste destrutivo dirigido no Sandbox.

## 5. Dependências reaproveitadas no carrinho

| Dependência | Como pode ser reaproveitada |
|---|---|
| `react` 19.2.4 | `useState`, `useMemo`, `useEffect` e Context, se necessário. Para o escopo atual, estado local no `StoreCatalog` é suficiente. |
| `next` 16.3.3 | App Router, componentes client/server e `next/image`. |
| `lucide-react` | Ícones de carrinho, mais, menos, lixeira e WhatsApp. |
| `class-variance-authority` | Variantes já usadas por `Button`. |
| `clsx` + `tailwind-merge` | Função `cn` para combinar classes. |
| `tailwindcss` 4 | Layout responsivo e consumo dos tokens/temas existentes. |
| `zod` | Não é necessário para o estado do carrinho, mas pode validar dados de entrada caso surja necessidade. |
| `@supabase/ssr` e `@supabase/supabase-js` | Não devem ser usados pelo carrinho, pois o requisito é 100% client-side sem persistência. |

Não há Redux, Zustand, Jotai, Context global de compras, biblioteca de modal/drawer ou biblioteca de animação. Não é necessário adicionar state management para este carrinho em memória.

## 6. Pendências conhecidas

### Funcionais/técnicas

1. **E-mail transacional e atendimento:** SMTP Resend, URLs finais, template em português, callback, troca de senha e novo login foram testados em `auth.clickcatalogo.com` com Gmail. O canal `contato@clickcatalogo.com` também teve recebimento pelo ImprovMX e envio pelo Resend validados com DKIM e TLS. Depois do deploy final será necessário reaplicar a versão anti-prefetch do template e validar a recuperação também no Outlook.
2. **Múltiplas lojas por usuário:** não fazem parte do produto atual. O banco garante uma loja por proprietário e o checkout bloqueia uma segunda compra com o mesmo e-mail.
3. **Gestão financeira futura:** o link exibido é a última fatura (`invoiceUrl`). Troca de cartão e upgrade/downgrade continuam fora do escopo; o cancelamento já é self-service.
4. **Testes automatizados:** existe uma suíte unitária inicial para transições de assinatura, moeda brasileira e tokens de recuperação. A cobertura de integração concorrente do webhook e o E2E completo ainda precisam evoluir antes de escala, sem executar cobranças reais no CI.
5. **Atualização de produto:** a Server Action devolve o produto salvo e a lista é atualizada no estado local, sem recarregar a página.
6. **Navegação ativa de categorias:** a pill ativa muda ao clicar, mas não acompanha automaticamente a seção visível durante scroll.
7. **Rate limiting distribuído:** a RPC compartilhada está ativa após `202608300007_fix_distributed_rate_limit.sql`; a auditoria real confirmou consumo atômico e limpeza do probe técnico. O fallback em memória permanece para webhook e rotas leves; operações públicas sensíveis respondem indisponibilidade temporária se a proteção compartilhada falhar.

### Bugs reportados anteriormente

Não há bug visual anteriormente reportado que permaneça reproduzido no código atual. Estão presentes as correções de:

- header estreito com CTA em nova linha;
- WhatsApp normalizado com `55`;
- preview sticky sem scroll interno próprio;
- overlay, recorte e fallback de banner/logo;
- card e imagem ocupando 100% da célula;
- mesmas regras de dimensão na prévia e loja real;
- busca/paginação/ISR e `next/image` no catálogo;
- aviso da 16ª categoria;
- responsividade, alvos de toque e links legais;
- campos de upload e Instagram mais claros;
- provisionamento e reconciliação do webhook;
- login por senha sem envio de e-mail;
- seleção correta do tenant quando um usuário possui mais de uma loja.

O carrinho e o polimento visual solicitado foram concluídos. Contadores nas categorias foram deliberadamente omitidos conforme a decisão do produto.

## 7. Implementação concluída nesta rodada

- estado do carrinho mantido em `StoreCatalog`, sem Context global desnecessário;
- quantidade e callbacks passam por `ProductGrid` até `ProductCard`;
- pedido individual continua disponível em todos os cards;
- `CartPanel` utiliza `dialog`, `Button`, `formatCurrency`, `createWhatsAppUrl` e os tokens `--cor-*`;
- nenhuma tabela, API, Server Action, `localStorage` ou `sessionStorage` foi adicionada;
- a mensagem consolidada lista cada item com quantidade, valor unitário, subtotal e total geral;
- pills e títulos de categoria foram refinados sem contadores;
- cards receberam altura-base, alinhamento das ações e fallback temático padronizados;
- landing, cadastro e painel recebem o polimento compartilhado do catálogo, mas o carrinho flutuante fica restrito à loja pública.

## 8. Auditoria para lançamento real

### P0 — implementado nesta rodada

1. **Recuperação self-service:** implementada com `resetPasswordForEmail`, callback PKCE e `updateUser`. SMTP Resend, Redirect URLs, recebimento real no Gmail, troca de senha e novo login foram validados. A versão local do template adiciona uma confirmação intermediária resistente a scanners de link e deve ser reaplicada no Supabase depois do deploy final.
2. **Asaas em Produção:** o código foi auditado. A chave `$aact_prod_` seleciona automaticamente `https://api.asaas.com/v3`; callbacks usam `NEXT_PUBLIC_SITE_URL` e não há dados de Sandbox fixados no checkout. A primeira cobrança real permanece um teste manual obrigatório e está roteirizada no `SETUP.md`.
3. **Rate limiting:** implementado por IP em RPC atômica no Supabase, compartilhada entre Functions da Netlify, com HMAC em vez do IP bruto. Checkout, senha inicial e recuperação falham fechados se o limitador distribuído estiver indisponível; webhook e rotas leves mantêm fallback local para preservar disponibilidade. As migrations `202608290006_prelaunch_hardening.sql` e `202608300007_fix_distributed_rate_limit.sql` já foram aplicadas.

### P1 — recomendação

| Item | Recomendação | Motivo técnico |
|---|---|---|
| Gestão avançada da assinatura | **Fazer depois do lançamento.** | O cancelamento self-service está concluído. Troca de cartão e upgrade/downgrade permanecem fora do escopo e exigem um fluxo separado. |
| Scrollspy de categorias | **Fazer logo depois.** | Melhora orientação em lojas longas, mas não afeta pedido, cobrança, isolamento ou disponibilidade. Esforço baixo. |
| Atualização local de produtos | **Concluída.** | A ação retorna o registro salvo; criação e edição aparecem imediatamente sem `window.location.reload()`. |
| Remover `/auth/callback` | **Não remover.** | A rota agora é parte obrigatória da recuperação de senha por PKCE. |

### P2 — decisão registrada

- **Múltiplos tenants:** permanece fora do escopo. A restrição `tenants_owner_user_id_unique_idx` e a consulta por e-mail impedem uma segunda loja para o mesmo usuário.
- **Testes automatizados:** fazer logo após o primeiro lançamento controlado. Priorizar testes de contrato do webhook/idempotência e um E2E sem pagamento real; o E2E completo com checkout Sandbox e webhook assíncrono tem esforço estimado de 1–2 dias.
- **Pix:** é tecnicamente viável no Checkout recorrente como `billingTypes: ["PIX"]`, mas nessa modalidade o Asaas gera cobranças mensais que o cliente paga manualmente. Débito automático real exige Pix Automático, autorização inicial, criação de cada instrução pela aplicação e novos webhooks; é uma integração separada, hoje sob acesso controlado no Asaas. Não implementar antes de validar demanda e elegibilidade da conta.

## 9. Auditoria final pré-lançamento

| # | Item auditado | Estado verificado | Ação antes do lançamento |
|---|---|---|---|
| 1 | Segredos no frontend | **Coberto no código.** `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `RESEND_API_KEY` são server-only; `.env.local` permanece ignorado. | Repetir a varredura do bundle no build final e manter todas sem prefixo `NEXT_PUBLIC_`. |
| 2 | Origem, autenticação e tenant | **Coberto para o escopo atual.** Checkout e criação inicial de senha exigem origem válida; webhook valida token antes do rate limit; entradas usam Zod e limitador distribuído. Server Actions exigem sessão e derivam o tenant de `requireTenant`. As migrations 007, 008 e 009 foram aplicadas e auditadas. | Repetir `npm run audit:live` após os testes de pagamento em Produção. |
| 3 | Logs sensíveis | **Coberto.** As mensagens registram contexto técnico limitado e texto de erro, sem gravar senha, payload completo de checkout/webhook, token, chave, e-mail ou número de WhatsApp. A varredura do build e dos arquivos versionados também não encontrou valores reais dos segredos. | Ao adicionar observabilidade, continuar sem registrar objetos completos de request, headers, usuário ou webhook e definir expiração para os logs da plataforma. |
| 4 | Falha/reentrega do webhook | **Coberto com ressalva operacional.** O Asaas trabalha com entrega `at least once`, tenta novamente falhas de forma progressiva, interrompe a fila após 15 falhas consecutivas e mantém eventos por até 14 dias. O endpoint persiste `event.id`, responde erro quando o processamento falha e ignora somente eventos já concluídos. Uma reentrega que encontra processamento recente agora recebe `409`, não um falso `200`, evitando perder o evento se a primeira execução tiver sido interrompida. | Manter envio sequencial, e-mail de alerta e monitorar **Asaas → Integrações → Logs de Webhooks**. Uma fila assíncrona externa é uma evolução recomendada se o volume crescer, pois hoje o processamento ainda ocorre antes do `200`. Referência: [FAQ oficial de Webhooks](https://docs.asaas.com/docs/faq-de-webhooks). |
| 5 | Timeout/aparelho perdido após pagamento | **Coberto localmente.** Além do polling com timeout, o titular pode recuperar a intenção por e-mail em outro dispositivo sem revelar o estado da conta e sem criar novo checkout quando o atual ainda vale. | Configurar as duas variáveis do Resend, aplicar migrations 011/012/013 e executar o teste cross-device no deploy. |
| 6 | Dois cadastros com o mesmo slug | **Coberto.** A consulta antecipada melhora a mensagem, mas a garantia real está no banco: `tenants.slug` é único e `signup_intents_pending_slug_unique_idx` bloqueia duas reservas iniciais pendentes. Uma colisão `23505` no insert retorna `409` legível. | Nenhuma. |
| 7 | Valores extremos | **Coberto.** Nome aceita no máximo 120 caracteres no input, Zod e constraint; preço com mais de duas casas agora é rejeitado com mensagem clara; vazios opcionais viram `null`. O bucket real aceitou um arquivo de **2 MB exatos**, rejeitou **2 MB + 1 byte** e o objeto temporário aceito foi removido logo após o teste. | Nenhuma. |
| 8 | Excluir categoria com produtos | **Coberto e intencional.** A FK do banco usa `on delete restrict`. A aplicação bloqueia a exclusão, informa quantos produtos estão vinculados e orienta mover ou excluir esses produtos primeiro. Nenhum produto é apagado em cascata. | Nenhuma. |
| 9 | Painel administrativo global | **Não existe.** O painel atual é exclusivo do lojista; para uma visão global ainda é necessário consultar o Supabase. | **Decisão do administrador:** definir se uma tela interna de tenants/status entra no curto prazo. Não bloqueia o primeiro lançamento controlado. |
| 10 | E-mails reais | **Recuperação e canal público validados no Gmail.** Supabase Auth envia pelo SMTP Resend em `auth.clickcatalogo.com`; template em português, callback PKCE, redefinição e novo login funcionam. `contato@clickcatalogo.com` recebe pelo ImprovMX e envia pelo domínio raiz verificado no Resend. | Após o deploy final, reaplicar a versão anti-prefetch do template e validar em Gmail/Outlook. Boas-vindas/compra continuam fora do escopo atual. |
| 11 | Pico de 100 acessos | **Coberto para carga leve.** No build de produção local conectado ao Supabase, um pico frio teve **100/100 HTTP 200**, total de 1,19 s e p95 de 1,14 s; uma segunda rodada teve **100/100 HTTP 200**, total de 0,84 s e p95 de 0,79 s. `unstable_cache` e ISR de 60 s impedem uma consulta RPC por visitante durante a janela. | O resultado valida o cenário moderado, mas não substitui teste distribuído na Netlify. Monitorar funções e Supabase no primeiro tráfego real; considerar cache remoto apenas se o volume crescer muito. |

### Cancelamento self-service: verificação desta rodada

- implementação validada por ESLint, TypeScript, contraste dos seis temas e build de produção;
- interface validada no painel em 375 px, sem overflow e sem alvo interativo menor que 44 px;
- a recorrência passa de `ACTIVE` para `INACTIVE`; `DELETE` fica restrito ao legado já existente e não é usado em novos cancelamentos;
- desfazer usa `ACTIVE` com `nextDueDate = access_until`, evitando cobrar novamente o período já pago;
- a finalização horária agora exige conciliação `complete`; estados `pending` e
  `attention` são repetidos e nunca escondidos pelo simples vencimento da data;
- a rotina reserva cada item por RPC, alterna para `processing`, respeita orçamento
  de 17 segundos e registra quantidade/duração e pendências sem PII;
- ambiente local configurado confirmado como **Sandbox** e uma assinatura íntegra com IDs Asaas foi localizada no novo Supabase;
- o fluxo funcional de Sandbox foi validado; a cobrança e o cancelamento controlados em Produção continuam pendentes.

## Conclusão

O catálogo público suporta pedidos individuais e com vários produtos; autenticação, recuperação pós-pagamento, cancelamento self-service, rate limiting distribuído, retenção e solicitação de exclusão estão implementados e auditados. Antes do primeiro cliente real ainda são obrigatórios: repetir `verify-setup.sql`, configurar uma `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` estável somente nos ambientes secretos, publicar esta release em lote, reaplicar o template anti-prefetch e concluir uma cobrança e um cancelamento controlados no Asaas de Produção. A validação em Outlook e a revisão jurídica permanecem recomendações fortes antes de escala comercial.

## Retomada em 28/08/2026

- este bloco registra o estado histórico daquela data; as alterações descritas foram publicadas posteriormente até o commit `e776300`;
- `npm run check` passou, incluindo ESLint, TypeScript e contraste AA dos seis temas;
- `npm run build` passou com Next.js 16.3.3 e todas as rotas esperadas;
- `supabase/schema.sql` foi cruzado com as tabelas, RPCs e bucket usados pelo código e permanece como instalação consolidada para um projeto vazio;
- foi adicionado `supabase/verify-setup.sql` para confirmar a instalação sem alterar dados;
- o novo Supabase respondeu pela chave pública e pela chave administrativa: RPC pública ativa, seis tabelas vazias e bucket `produtos` público com limite de 2 MB;
- foi adicionado `netlify.toml` com build Next.js, Node.js 22 e proteção entre deploys;
- o requisito local foi alinhado para Node.js 22 ou superior, compatível com a versão atual do cliente Supabase;
- `SETUP.md` e `CONFIGURACAO_AMBIENTE.md` agora descrevem o novo Supabase e a Netlify;
- `.env.local` já aponta para o novo Supabase e para `https://clickcatalogo.com`;
- o deploy da Netlify, o webhook Sandbox, o SMTP, a recuperação de senha, o DNS e o HTTPS do domínio final foram validados; o fluxo Asaas de Produção ainda não foi validado.

## Retomada em 29/08/2026

- Next.js e `eslint-config-next` foram atualizados para `16.3.3`, PostCSS para `8.5.26` e `npm audit --omit=dev` passou com zero vulnerabilidades;
- `npm run check` passou sem warnings e o build de produção preservou a geração estática/ISR da loja pública;
- foi criada a migration `202608280005_expire_stale_signup_intents.sql` e a RPC restrita à `service_role` para liberar slugs pendentes vencidos mesmo sem o webhook `CHECKOUT_EXPIRED`;
- disponibilidade de slug, checkout e consulta de status executam a expiração defensiva antes de consultar reservas;
- `.env.example` voltou a usar placeholders, `.env.local` permanece ignorado e a varredura não encontrou segredo real no estado versionado;
- respostas agora recebem CSP compatível com o Supabase, proteção contra iframe, `nosniff`, política de referência e restrições de permissões; os headers foram confirmados por uma requisição ao build local;
- Resend está conectado ao Supabase Auth, DNS verificado e recuperação real validada; resta aplicar o template em português e melhorar a reputação de entrega;
- `clickcatalogo.com` e `www.clickcatalogo.com` apontam para a Netlify, possuem certificado Let's Encrypt válido e o `www` redireciona para o domínio raiz.

## Auditoria em 30/08/2026

- o deploy de produção, domínio, HTTPS, headers, rotas públicas, painel protegido, catálogo real, `robots.txt` e `sitemap.xml` passaram pela rotina `npm run audit:production`; a versão ampliada da auditoria agora bloqueia corretamente apenas a identificação legal ainda não configurada;
- na fotografia da auditoria daquele dia, o Supabase continha 1 tenant, 1 assinatura, 1 categoria, 1 produto, 1 intenção de cadastro e 2 webhooks processados, sem órfãos, duplicidades ou eventos pendentes;
- `npm audit` completo retornou zero vulnerabilidades conhecidas no lockfile local;
- a loja inexistente usa o `not-found` do Next.js e recebe `noindex`; em respostas transmitidas por streaming, o framework mantém HTTP 200 por projeto;
- o limite das Server Actions foi alinhado aos uploads de logo/banner e ao teto efetivo da Netlify;
- uploads agora conferem assinatura binária de JPG, PNG e WebP no servidor, além de MIME e tamanho;
- o status inadimplente não é mais exposto ao comprador na loja pública;
- o webhook preserva cancelamento como estado terminal diante de eventos financeiros atrasados;
- foi encontrada e corrigida a colisão SQL de `current_time` na RPC distribuída; `202608300007_fix_distributed_rate_limit.sql` foi aplicado e a chamada real passou;
- os Termos e a Política foram ampliados, a identificação pública do fornecedor passou a ser configurável por `LEGAL_*` e a migration `202608300008_legal_acceptance_versions.sql` foi aplicada sem aceites sem versão;
- foi criada `docs/OPERACAO.md` com release em lote, monitoramento, backup manual do Supabase Free e resposta a incidentes;
- o backup do Storage percorre o bucket inteiro, preserva subpastas e objetos órfãos e registra tamanho e SHA-256 de cada arquivo no manifesto;
- a configuração local do Asaas continua em Sandbox, portanto nenhuma cobrança real deve ser aceita antes da troca consciente para uma chave de Produção;
- a identificação legal e o canal público foram cadastrados na Netlify; a confirmação visual será repetida após o deploy final.
- o webhook `ClickCatalogo Sandbox` foi auditado pela API oficial no domínio final, com fila ativa e envio sequencial; após esta release deve incluir também `PAYMENT_DELETED` e `SUBSCRIPTION_UPDATED`, totalizando dez eventos obrigatórios.
- a API Key e o webhook de Produção foram preparados manualmente e permanecem fora do projeto; ativação, auditoria e primeira cobrança real serão feitas somente na virada final da Netlify.

### Fechamento local antes do próximo deploy

- a área `/painel/privacidade`, a fila de exclusão, o executor em simulação por padrão e a migration `202608300009` foram concluídos e aplicados no Supabase público;
- `npm run audit:live` confirmou as novas tabelas e funções sem órfãos, eventos pendentes, jobs travados ou inconsistências de cancelamento;
- `supabase/verify-setup.sql` foi repetido no ambiente público e a RPC distribuída respondeu com `allowed = true`, concluindo a validação estrutural do Supabase;
- o claim do webhook passou a ser atômico, com lease para processamento interrompido e proteção contra concorrência em reentregas;
- uploads JPG, PNG e WebP agora validam assinatura, formato real, dimensões, quantidade de pixels, animação e decodificação antes do Storage;
- todas as 11 rotas principais foram inspecionadas em 375, 768, 1024 e 1440 px, sem overflow da página ou alvo interativo visível abaixo do mínimo adotado; a navegação móvel centraliza automaticamente a aba ativa;
- depois de restaurar as dependências pelo `package-lock.json`, `npm run check`, `npm run build` e `npm audit --omit=dev` passaram com Node.js 24 e zero vulnerabilidades conhecidas;
- nenhum commit, push ou deploy foi feito nesta rodada; as alterações continuam acumuladas para uma única publicação final.
