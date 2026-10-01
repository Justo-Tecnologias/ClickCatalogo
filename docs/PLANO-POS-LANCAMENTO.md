# ClickCatálogo — Plano pós-lançamento e evolução do produto

Última revisão: **30 de setembro de 2026**.

Este documento organiza o trabalho após a primeira publicação comercial do ClickCatálogo. Ele deve ser usado como fonte principal para decidir a ordem das próximas entregas, registrar validações e impedir que novas funcionalidades sejam misturadas com correções urgentes de produção.

## 1. Objetivo do plano

O objetivo imediato é lançar com segurança, observar o comportamento real do sistema e evoluir o produto sem comprometer os fluxos já validados:

- cadastro e checkout recorrente;
- confirmação de pagamento por webhook;
- criação e recuperação de acesso;
- painel multi-tenant;
- configuração da loja, categorias e produtos;
- catálogo público, carrinho e pedido pelo WhatsApp;
- cancelamento, reativação, retenção e privacidade;
- troca segura do endereço público da loja.

## 2. Princípios para as próximas releases

1. **Estabilidade antes de expansão:** erros de pagamento, acesso, isolamento de dados ou perda de conteúdo sempre têm prioridade sobre funcionalidades comerciais.
2. **Uma release por objetivo:** evitar misturar correção financeira, mudança de schema e grande alteração visual no mesmo deploy.
3. **Poucos deploys:** reunir alterações relacionadas, validar localmente e publicar um pacote completo para economizar créditos da Netlify.
4. **Banco antes do código:** toda migration necessária deve ser aplicada e verificada antes do deploy que depende dela.
5. **Compatibilidade progressiva:** migrations devem ser incrementais, idempotentes quando possível e não apagar dados existentes.
6. **Falha segura:** checkout, autenticação, webhook e operações administrativas devem interromper o fluxo quando uma dependência crítica não puder ser confirmada.
7. **Mobile primeiro:** painel e catálogo devem ser avaliados inicialmente em 375 px, pois esse será o principal contexto de uso.
8. **Privacidade desde o início:** analytics, pixels, integrações e diretório público devem coletar somente o necessário e respeitar consentimento e finalidade.
9. **Sem segredos no Git:** chaves reais ficam somente no ambiente local ignorado, Netlify, Supabase, Asaas ou fornecedor correspondente.
10. **Evidência de conclusão:** nenhuma tarefa é considerada concluída somente porque o código foi escrito; ela precisa de teste e critério de aceite verificável.

## 3. Estado atual deste planejamento

Revisado em **30 de setembro de 2026**, após a auditoria completa do projeto e duas releases publicadas no mesmo dia.

### 3.1 Produção agora

| Item | Estado |
|---|---|
| Commit publicado | `ba64198` — merge do PR #11 (Release B) sobre o PR #9 (Release A) |
| Next.js | **16.3.8** (corrige GHSA-vcvr-r3jv-pc5j, RCE em `next/og`) |
| Migrations aplicadas em produção | até `202609300025_overdue_suspension_policy.sql` |
| Asaas | conta de **produção**; webhook "ClickCatalogo Produção" ativo, fila sem interrupção, 10 eventos (auditado com `audit-asaas` em 30/09) |
| Webhook do Sandbox | desativado e com fila interrompida — inofensivo; só reativar se voltar a testar no Sandbox |
| Lojas públicas indexadas | `justo-shop` e `atelie-aurora` (ambas `ativo`) |
| Auditorias | `audit:production` sem falhas; `audit-slug-integrity.sql` sem conflitos |
| Scheduled Function | executando de hora em hora sem erro (~3 s; log de 30/09 22:15 com todos os contadores em zero) |
| Termos | versão `2026-09-30` publicada; aviso enviado aos 2 titulares ativos |
| Qualidade | 69 testes, lint, TypeScript, contraste AA e build aprovados |

### 3.2 O que foi entregue em 30/09/2026

#### Release A — segurança e ajustes (PR #9)

| Commit | Entrega |
|---|---|
| `7601421` | `slug` saiu da permissão de UPDATE do titular em `tenants` (migration 023). Antes, o lojista podia trocar o endereço pela API sem passar por `change_tenant_slug`, contornando histórico, aliases protegidos e reservas de cadastro — inclusive tomando um slug reservado por um checkout pago, o que impediria o provisionamento. Inclui `supabase/audit-slug-integrity.sql`. |
| `492a47a` | Documentação do Resend corrigida (a API direta é usada em **Acessar minha loja** e no **Atendimento**). `/atendimento` expõe `data-support-channel` e mostra o e-mail direto quando o canal não está pronto; `audit:production` confere o indicador. |
| `06ef1f7` | Link externo ("Ver oferta") aceita somente Mercado Livre, Shopee, Amazon, Magalu, AliExpress e Shein. Links antigos fora da lista somem da loja e recebem o selo "Link não exibido" no painel. Lista em `src/lib/catalog/external-links.ts`. |
| `b725264` | Imagem Open Graph usa os tokens dos temas (`src/lib/design-system/theme-colors.ts`); `check:contrast` falha se divergir de `themes.css`. |
| `c30ea7a` | Webhook localiza usuário do Auth por e-mail via RPC `find_auth_user_id_by_email` (migration 024), com a paginação antiga como plano B. |
| `a79a0b0` | Métricas da vitrine também contam lojas inadimplentes que continuam no ar. |

#### Release B — política de pagamento em atraso (PR #11)

Fonte única da regra: `src/lib/billing/overdue-policy.mjs`, refletida no banco pela migration 025.

| Dia do atraso | Comportamento |
|---|---|
| 0 a 7 | Loja no ar; faixa no painel com data limite, "Pagar fatura" e "Ver assinatura" |
| 1, 6 e 25 | E-mail de aviso, uma vez por marco, com chave idempotente; botão leva à fatura oficial do Asaas (somente `*.asaas.com`) |
| 8 em diante | Catálogo indisponível com mensagem neutra (`get_public_store_status = 'suspenso'`); selo "Loja fora do ar" no painel |
| 30 | Scheduled Function inativa a recorrência, remove cobranças abertas e só então encerra a loja; começa a retenção de 30 dias |

| Commit | Entrega |
|---|---|
| `e03e438` | Política completa: migration 025, webhook (`PAYMENT_OVERDUE` grava `overdue_since` e fatura; pagamento zera o ciclo), rotina horária, `OverdueBanner`, e-mails (`overdue-emails.mjs`), Termos `2026-09-30`, FAQ e `scripts/notify-terms-update.mjs`. |
| `3a51278` | Restaura delimitadores `$$` no `schema.sql` (a migration não foi afetada) e faz um atraso em assinatura que estava em dia abrir sempre um ciclo novo. |
| `dd2fb60` | Rotina horária completa `overdue_since` de assinaturas atrasadas sem data (rede de segurança). |
| `ebcd034` | **Segurança:** Next.js 16.3.3 → 16.3.8. |
| `5ed2971` | Teste da rotina isolado das variáveis do Resend (o build da Netlify falhava por isso). |

O SQL da migration 025 foi validado com PGlite em 19 cenários: schema anterior + 025 (caminho da produção) e instalação do zero, cobrindo dias 7/8/30, avisos, leases, a corrida pagamento × encerramento e `verify-setup.sql`.

### 3.3 Decisões registradas

| Data | Decisão | Motivo |
|---|---|---|
| 30/09 | Corrigir slug revogando a permissão e auditando produção | Menor mudança que fecha o contorno; auditoria confirmou que não houve abuso |
| 30/09 | Atraso: 7 dias no ar, fora do ar a partir do 8º, encerramento no 30º | Equilíbrio entre recuperar o cliente e não manter loja de graça |
| 30/09 | Avisos: faixa no painel + e-mails nos dias 1, 6 e 25 | Recuperação sem excesso de mensagens |
| 30/09 | Botão do e-mail leva direto à fatura do Asaas | Menor atrito para pagar; domínio validado contra golpe |
| 30/09 | No 30º dia, remover cobranças abertas; retorno pelo checkout de reativação | Impede pagamento de loja já encerrada sem reativação |
| 30/09 | Lojas já inadimplentes começam a contar na aplicação da migration | Ninguém sai do ar sem receber o ciclo de avisos |
| 30/09 | Termos `2026-09-30` + aviso único aos titulares, sem novo aceite | Transparência sem atrito |
| 30/09 | Link externo somente para marketplaces conhecidos, validado no painel e na loja, sem migration | Reduz uso do domínio para phishing sem custo de manutenção no banco |
| 30/09 | Correção de segurança do Next.js publicada junto com a Release B | Um único deploy |
| 30/09 | **Não** executar cobrança e cancelamento controlados em produção | Decisão do titular; o primeiro cliente real será acompanhado de perto (ver 3.5) |
| 01/10 | Próximo foco: **converter visitantes** (Release C) | Produto estável; o gargalo passa a ser aquisição |
| 01/10 | Refazer a Ateliê Aurora como loja vitrine, mesmo endereço | A versão anterior tinha ilustrações genéricas, banner com texto sobreposto e um produto sem imagem |
| 01/10 | Fotos de bancos livres (Pexels), aprovadas antes do download | Uso comercial permitido; créditos em `planejamento-justo-tecnologias/social-media/demo/atelie-aurora/CREDITOS.md` |
| 01/10 | Modo demonstração do painel passa a espelhar a Ateliê Aurora | História coerente entre landing, prints, demonstração e loja real |
| 01/10 | `/como-funciona` com prints reais; passo do WhatsApp como balão gerado pelo sistema | O texto vem de `createCartMessage`, sempre igual ao pedido real |

### 3.4 Lições operacionais

- **Chaves do Asaas começam com `$`.** No PowerShell, use aspas **simples**: `$env:ASAAS_API_KEY = '$aact_prod_...'`. Com aspas duplas o valor fica vazio e os scripts usam silenciosamente a chave de Sandbox do `.env.local`.
- **Esta máquina usa Node 20.** Scripts que exigem Node 22 rodam com:
  `npx -y -p node@22 node --env-file-if-exists=.env.local scripts/<script>.mjs`
  executado dentro de `C:\Projeto-Github\ClickCatálogo`.
- **`.env.local` não contém Resend nem chave de produção do Asaas.** Defina-as somente na sessão do PowerShell quando necessário e feche a janela depois.
- **O SQL Editor do Supabase mostra apenas o resultado da última consulta.** Para auditorias com várias consultas, execute uma de cada vez.
- **Nunca montar SQL com `String.replace` usando texto de substituição:** `$$` vira `$`. Use fatiamento ou função de substituição; o teste `funções SQL mantêm delimitadores $$ íntegros` protege o `schema.sql`.
- **Verificar loja no ar pelo botão "Falar no WhatsApp"**, não pela palavra "Catálogo" (ela também aparece em "ClickCatálogo" na página de loja inexistente).
- **Variáveis do ambiente de build afetam testes.** A Netlify tem Resend configurado; testes que dependem de ambiente devem limpar as variáveis.
- **Prints reais:** o Chrome local, em modo headless e controlado pelo DevTools Protocol, captura páginas em 1440 px e 390 px. O painel é fotografado no modo demonstração (cookie `catalogoja-demo=1`), sem login. Em `next dev`, esconda o botão de desenvolvimento (`nextjs-portal`) e espere o "Endereço disponível" antes de avançar o cadastro.
- **Classes condicionais em botões:** `buttonVariants` não resolve conflitos de classe; combine com `cn(...)` ao esconder um botão por breakpoint.
- **Migration antes do deploy:** quando o banco recebe uma regra antes do código, prever o intervalo (ex.: rede de segurança `overdueBackfilled`).

### 3.5 Fila imediata

#### P0 — acompanhar o primeiro cliente real (substitui o teste controlado)

- [ ] Netlify: confirmar que `ASAAS_API_KEY` começa com `$aact_prod_`.
- [ ] No primeiro pagamento: `CHECKOUT_PAID` e `PAYMENT_CONFIRMED` com resposta 200 em **Asaas → Integrações → Logs de Webhooks**.
- [ ] Cliente cria a senha na tela de sucesso e entra no painel da loja correta.
- [ ] Rodar `audit-asaas` e `audit:live` após o primeiro pagamento.
- [ ] No primeiro cancelamento: `reconciliation.completed` sobe e `attention` permanece 0 no log da rotina.
- [ ] No primeiro atraso: e-mail do dia 1 aparece como `overdueNotices.sent` no log.

#### P1 — decisões pendentes do titular

- [ ] **Higgsfield:** em 30/09 surgiram alterações locais não commitadas no `master` — `scripts/higgsfield/index.ts` (exemplo de vídeo com IA, modelo Seedance 2.5), `@higgsfield/client` como dependência **de produção**, script `higgsfield:example` e `HF_CREDENTIALS` no `.env.example`. Decidir se fica neste repositório (como `devDependency` ou fora do bundle) ou num projeto separado de marketing.
- [ ] **Pasta `marketing/`:** continua fora do Git; decidir se é versionada, ignorada ou movida.
- [ ] **Próximo foco de produto** (ver seção 18).

#### P2 — dívida técnica curta

- [x] `audit:production`: a checagem `loja-real` agora usa o marcador "Falar no WhatsApp" e confere a `atelie-aurora` por padrão (Release C).
- [ ] Atualizar `STATUS.md`, desatualizado desde 15/09.
- [ ] Alerta "high" do `brace-expansion` (somente ferramentas de desenvolvimento) via Dependabot.
- [ ] Teste de SQL permanente: hoje a validação com PGlite rodou fora do repositório. Avaliar adicionar `@electric-sql/pglite` como `devDependency` e um teste que carregue `schema.sql` e as migrations.
- [ ] Lint no Windows reporta `no-img-element` em `opengraph-image.tsx` (no Linux a regra ignora o arquivo); inofensivo.
- [ ] E2E de cadastro/retomada, login, CRUD essencial, carrinho e cancelamento, sem cobrança real.
- [ ] Monitoramento de exceções sem PII e alerta para Scheduled Function atrasada ou `attention`/`superseded`.
- [ ] Observação: o evento `overdue.cancellation.superseded` exige reativação manual da recorrência no Asaas (ver `docs/OPERACAO.md`).

#### Release C — conversão (branch `feat/release-c-conversao`, em andamento)

- [x] Ateliê Aurora refeita em produção com 12 produtos, logo e banner reais (`scripts/import-atelie-aurora.mjs`; backup em `backups/`).
- [x] Página `/como-funciona` com 5 passos e prints reais (desktop e celular), balão do WhatsApp e chamadas para cadastro e loja de exemplo.
- [x] Landing: link para o passo a passo e card "Veja uma loja no ar"; cabeçalho e rodapé compartilhados.
- [x] Demonstração do painel espelhando a Ateliê Aurora (`/loja/atelie-aurora-demo`).
- [x] Funil medido: `landing_view` e `how_it_works_view` (migration 026), lido com `supabase/funnel-report.sql`. Atenção: em 01/10 houve cerca de 10 eventos artificiais vindos da captura dos prints.
- [ ] Publicar: PR, Deploy Preview e conferência visual em produção.
- Refinamento anotado: no desktop, categorias com 3 produtos deixam a 4ª coluna vazia na grade da loja.

Para refazer os prints, use a ferramenta de captura com Chrome headless descrita na seção 3.4.

#### Pacote de conversão 1 (branch `feat/pacote-conversao`)

- [x] Hero com a loja real no celular e o pedido chegando no WhatsApp (texto de `createCartMessage`).
- [x] Faixa "Novo" no topo da landing, configurada em `src/lib/marketing/announcements.ts`. **Regra: só funcionalidades já publicadas, sem datas de entregas futuras.**
- [x] Botão fixo "Quero minha loja" no celular, que some sobre o hero, o plano, a chamada final e o rodapé.
- [x] Imagem de compartilhamento (Open Graph) da landing e de `/como-funciona`. Ela fica no mesmo segmento de cada página, porque o `openGraph` da página substitui o herdado.
- Limitação conhecida: o gerador de imagens só tem a fonte padrão em peso normal (a Inter do projeto está em WOFF2); vale também para a imagem das lojas.

Próximos pacotes sugeridos (análise de 01/10): valor para o lojista ("Sua loja esta semana" com visitas e cliques, informações da loja, campos opcionais no pedido) e, com dados do funil, o teste de "monta grátis, paga para publicar".

#### Itens da fila anterior (23/09) já resolvidos

- [x] Deploy financeiro `9b44703` publicado.
- [x] Sitemap sem lojas técnicas: agora lista somente `justo-shop` e `atelie-aurora`.
- [x] `audit:production` deixou de procurar "Produtos em destaque".
- [x] Webhook de produção com os 10 eventos, inclusive `PAYMENT_DELETED` e `SUBSCRIPTION_UPDATED`.
- [ ] ~~Contratação e cancelamento controlados~~ — substituído pelo acompanhamento do primeiro cliente (decisão de 30/09).

## 4. Fase 0 — estabilização do deploy publicado

Esta fase começa imediatamente após cada deploy de lançamento. Não iniciar uma funcionalidade grande antes de concluir os testes abaixo.

### 4.1 Verificação da infraestrutura

- [ ] Deploy principal da Netlify terminou com estado verde.
- [ ] O domínio `https://clickcatalogo.com` abre com HTTPS válido.
- [ ] `www.clickcatalogo.com` redireciona para o domínio canônico definido.
- [ ] `NEXT_PUBLIC_SITE_URL` aponta para `https://clickcatalogo.com`.
- [ ] Variáveis do Supabase, Asaas, Resend e segurança estão disponíveis no contexto de produção da Netlify.
- [ ] Nenhuma chave de sandbox está ativa na produção.
- [ ] Webhook do Asaas aponta para `https://clickcatalogo.com/api/webhooks/asaas`.
- [ ] URLs autorizadas do Supabase Auth incluem o domínio final e os callbacks usados pela aplicação.
- [ ] Scheduled Functions da Netlify estão executando sem erro.

### 4.2 Smoke test público

- [ ] `/` responde e os CTAs abrem os destinos corretos.
- [ ] “Ver os temas” leva à seção de temas.
- [ ] `/termos`, `/privacidade` e `/atendimento` têm conteúdo real.
- [ ] `/painel` exibe login e acesso à recuperação.
- [ ] Uma `/loja/[slug]` ativa carrega logo, banner, categorias e produtos.
- [ ] Loja cancelada não aceita pedidos e não revela detalhes financeiros.
- [ ] Open Graph de uma loja apresenta nome e descrição corretos ao compartilhar.
- [ ] Não há erros relevantes no console do navegador.

### 4.3 Smoke test autenticado

- [ ] Login com e-mail e senha funciona.
- [ ] Logout mostra estado de carregamento e encerra a sessão.
- [ ] Recuperação de senha envia e-mail e permite definir nova senha.
- [ ] Menu lateral mobile abre, fecha e mantém foco e navegação utilizáveis.
- [ ] Atalho superior “Abrir loja” abre a loja correta.
- [ ] Alteração de nome, descrição, WhatsApp, Instagram, endereço e tema é persistida.
- [ ] Upload, troca e remoção de logo e banner funcionam.
- [ ] Proteção contra saída sem salvar aparece quando necessário.
- [ ] Toasts de sucesso e erro são compreensíveis.

### 4.4 Categorias e produtos

- [ ] Criar, editar e reordenar categoria funciona.
- [ ] Categoria com produto vinculado não pode ser excluída.
- [ ] O aviso oferece acesso direto aos produtos daquela categoria.
- [ ] Criar produto formata corretamente o preço em reais.
- [ ] Editar, publicar, ocultar e excluir produto funciona.
- [ ] Troca e remoção de imagem limpam o arquivo antigo conforme esperado.
- [ ] Busca por nome e descrição funciona.
- [ ] Filtros por categoria e visibilidade funcionam em conjunto.
- [ ] Lista extensa usa carregamento progressivo.

### 4.5 Catálogo, carrinho e WhatsApp

- [ ] Mobile mostra dois cards por linha quando houver espaço previsto pelo design.
- [ ] Imagens preservam proporção e não causam layout shift significativo.
- [ ] Busca aparece somente com mais de 12 produtos.
- [ ] Categorias ficam sticky somente nas condições definidas.
- [ ] “Carregar mais” aparece após 20 produtos na categoria.
- [ ] Pedido individual contém o produto correto.
- [ ] Carrinho permite adicionar, remover e alterar quantidades.
- [ ] Total consolidado usa valores e formatação corretos.
- [ ] Pedido consolidado abre o WhatsApp correto com todos os itens.
- [ ] Botões têm área de toque confortável e não dependem somente de hover.

### 4.6 URL da loja

- [ ] Disponibilidade é validada antes da troca.
- [ ] URL atual abre a loja diretamente.
- [ ] Cada URL antiga redireciona diretamente para a atual, sem cadeia intermediária.
- [ ] Aliases ficam protegidos por 30 dias.
- [ ] Depois do prazo, o endereço deixa de bloquear outro cadastro.
- [ ] No máximo três aliases antigos ficam ativos simultaneamente.
- [ ] QR Code, copiar link e compartilhar usam a URL atual após a troca.

### 4.7 Pagamento real controlado

Executar com valor oficial e uma identidade de teste controlada. Não reutilizar cadastro de cliente real.

- [ ] Cadastro valida e-mail existente antes da etapa de pagamento.
- [ ] Checkout mostra cobrança recorrente mensal no cartão.
- [ ] Pagamento aprovado retorna à tela de sucesso.
- [ ] A tela aguarda o webhook e não usa apenas o retorno visual como confirmação.
- [ ] Webhook é registrado uma única vez mesmo com reentrega.
- [ ] Tenant, assinatura e proprietário são vinculados corretamente.
- [ ] Criação da primeira senha funciona.
- [ ] Login abre exatamente a loja recém-criada.
- [ ] `signup_intents` termina provisionado sem duplicidade.
- [ ] Não existe cobrança duplicada no Asaas.

### 4.8 Cancelamento controlado

- [ ] Cancelamento exige confirmação com o nome da loja.
- [ ] Próxima recorrência é interrompida no Asaas.
- [ ] Acesso permanece até o fim do período pago.
- [ ] Cobranças futuras pendentes são conciliadas.
- [ ] “Desfazer cancelamento” funciona antes do fim do período.
- [ ] Encerramento final não acontece antes da conciliação completa.
- [ ] Renovação preserva tenant, produtos e URL da loja.

### 4.9 Observação após os testes

Durante pelo menos as primeiras horas após o deploy:

- [ ] revisar logs da Netlify;
- [ ] revisar logs e Auth do Supabase;
- [ ] revisar entregas e rejeições do Resend;
- [ ] revisar eventos, cliente, assinatura e webhook no Asaas;
- [ ] registrar qualquer incidente com horário, rota, request ID e impacto;
- [ ] evitar corrigir diretamente em produção sem reproduzir ou compreender a causa.

## 5. Fase 1 — operação, segurança e confiabilidade

Esta é a primeira release pós-lançamento. Ela tem prioridade sobre novas páginas comerciais.

### 5.1 Monitoramento de erros

Objetivo: descobrir falhas antes que clientes precisem entrar em contato.

Escopo proposto:

- escolher ferramenta com camada gratuita adequada;
- capturar exceções de páginas, Route Handlers e Server Actions;
- ocultar chaves, tokens, payloads financeiros e dados pessoais;
- correlacionar erros com request ID;
- criar alertas somente para erros acionáveis;
- separar falhas de usuário, dependência externa e defeito interno.

Critérios de aceite:

- erro intencional de teste aparece no monitoramento sem PII;
- erro do checkout inclui rota, ambiente e request ID;
- alerta chega ao canal operacional escolhido;
- mapa de resolução está documentado em `docs/OPERACAO.md`.

### 5.2 Rate limiting com tráfego real

O limitador distribuído já usa o Supabase e falha fechado nas operações críticas. A próxima etapa não é trocar imediatamente de tecnologia, e sim medir.

Avaliar:

- quantidade de bloqueios legítimos e suspeitos;
- diferença entre checkout, login, recuperação, slug e webhook;
- comportamento de IPs compartilhados de redes móveis;
- crescimento da tabela e expurgo;
- custo e latência adicionados por requisição.

Somente migrar para Redis/KV dedicado se métricas mostrarem necessidade.

Critérios de aceite:

- limites documentados por endpoint;
- logs não armazenam IP bruto;
- usuário recebe tempo de espera compreensível;
- webhook legítimo não é bloqueado em volume normal;
- teste de múltiplas instâncias continua passando.

### 5.3 Backup e recuperação

- agendar backup do banco compatível com o plano contratado;
- executar e guardar inventário do Storage;
- definir onde cópias serão armazenadas com acesso restrito;
- documentar restauração em ambiente separado;
- testar restauração de ao menos um tenant e seus arquivos;
- definir RPO e RTO realistas para o estágio do produto.

Critério principal: um backup sem teste de restauração não é considerado uma estratégia concluída.

### 5.4 Rotinas agendadas

- monitorar finalização de cancelamentos;
- monitorar reconciliações em `pending`, `processing` ou `attention`;
- monitorar fila de exclusão e retentativas;
- executar expurgo inicialmente em modo simulação;
- habilitar exclusão real somente depois de revisar o relatório;
- alertar jobs que deixarem de executar.

## 6. Fase 2 — página individual de produto e compartilhamento

Prioridade comercial recomendada após estabilização.

### 6.1 Objetivo

Criar uma página compartilhável para cada produto, semelhante a:

```text
/loja/[slug]/produto/[productId-ou-slug]
```

A decisão entre ID e slug próprio deve ser feita antes da migration. A opção preferencial é um slug de produto único dentro do tenant, mantendo o UUID como identidade interna.

### 6.2 Conteúdo da página

- imagem principal responsiva;
- nome, preço, descrição e variações;
- identificação e link de retorno para a loja;
- botão de pedido individual;
- controle de adicionar ao carrinho;
- produtos relacionados da mesma categoria;
- fallback visual consistente;
- mensagem adequada para produto oculto ou removido.

### 6.3 SEO e compartilhamento

- metadata própria por produto;
- canonical correto;
- Open Graph com nome, preço, loja e imagem;
- imagem OG dinâmica sem expor dados privados;
- Twitter card;
- botão de compartilhar usando Web Share API e fallback de cópia;
- URLs montadas a partir de `NEXT_PUBLIC_SITE_URL`.

### 6.4 Segurança e dados

- RPC pública retorna somente produto ativo de loja disponível;
- nenhuma consulta pública usa `service_role` sem necessidade;
- produto nunca pode ser lido por meio de tenant diferente;
- cache é invalidado ao editar, ocultar ou excluir o produto;
- URL antiga recebe comportamento definido caso o slug do produto mude.

### 6.5 Critérios de aceite

- compartilhamento no WhatsApp gera cartão visual correto;
- página funciona sem JavaScript para conteúdo essencial;
- Lighthouse e Core Web Vitals permanecem aceitáveis;
- pedido usa o WhatsApp e o nome correto do produto;
- produto oculto deixa de aparecer e não é indexado.

## 7. Fase 3 — vitrine pública de lojas

### 7.1 Objetivo

Criar `/lojas` como área de descoberta e prova social, sem publicar automaticamente dados que o titular não autorizou.

### 7.2 Decisões obrigatórias antes de implementar

- participação automática ou opt-in;
- critérios para uma loja aparecer;
- possibilidade de ocultar a loja da vitrine sem tirar o catálogo do ar;
- categorias comerciais da vitrine;
- moderação de nomes, imagens e conteúdo impróprio;
- ordenação neutra, recente, destaque manual ou patrocinado;
- tratamento de lojas inadimplentes, canceladas e vazias.

Recomendação: usar **opt-in explícito** no painel.

### 7.3 Escopo inicial

- página `/lojas` paginada;
- cards com logo, nome e descrição curta;
- busca por nome;
- filtro simples por segmento, se houver dados suficientes;
- página vazia e estados de carregamento;
- sitemap apenas para lojas autorizadas e disponíveis;
- painel com opção “Aparecer na vitrine do ClickCatálogo”.

### 7.4 Segurança e moderação

- rate limit na busca pública;
- nenhuma exposição de e-mail, telefone bruto ou owner ID;
- botão de denúncia ou atendimento;
- possibilidade administrativa de retirar conteúdo;
- política clara para conteúdo proibido;
- proteção contra enumeração massiva desnecessária.

## 8. Fase 4 — banners promocionais da loja

Não confundir com o banner de identidade visual já existente no cabeçalho.

Escopo proposto:

- um ou mais banners promocionais opcionais;
- título, texto curto, imagem, CTA e URL segura;
- período de publicação com início e fim;
- ordenação;
- preview no painel;
- recorte responsivo e limites de tamanho;
- fallback sem imagem;
- validação contra links perigosos.

Começar com apenas um banner ativo por loja reduz complexidade e facilita validar o uso real.

## 9. Fase 5 — analytics e pixels

### 9.1 Métricas próprias

Expandir os contadores agregados já existentes antes de depender somente de plataformas externas:

- visualizações de loja;
- cliques em produto;
- adições ao carrinho;
- abertura do carrinho;
- pedido individual;
- pedido consolidado;
- início e conclusão de cadastro;
- falhas de checkout por categoria, sem payload sensível.

### 9.2 Google Analytics e Meta Pixel

Antes de integrar:

- definir base legal e consentimento;
- atualizar política de privacidade;
- implementar banner de cookies quando necessário;
- impedir carregamento antes da escolha do usuário quando aplicável;
- não enviar nome, e-mail, telefone, conteúdo do carrinho ou identificadores internos;
- permitir configuração global e, futuramente, configuração por tenant somente com regras claras.

Critérios de aceite:

- consentimento pode ser aceito, recusado e revogado;
- sem consentimento, scripts opcionais não carregam;
- eventos não duplicam em navegação do App Router;
- ambiente local e preview não contaminam dados de produção.

## 10. Fase 6 — central de ajuda e conteúdo

### 10.1 Estrutura recomendada

- `/ajuda` — índice pesquisável;
- `/ajuda/primeiros-passos`;
- `/ajuda/configurar-loja`;
- `/ajuda/categorias`;
- `/ajuda/produtos`;
- `/ajuda/compartilhar`;
- `/ajuda/pedidos-whatsapp`;
- `/ajuda/assinatura`;
- `/ajuda/cancelamento`;
- `/blog` para conteúdo comercial e SEO, separado da documentação operacional.

### 10.2 Requisitos

- linguagem simples para público não técnico;
- imagens atualizadas do painel;
- artigos versionados junto com mudanças relevantes;
- busca client-side inicialmente;
- CTA de atendimento quando o artigo não resolver;
- dados estruturados de FAQ quando apropriado;
- não prometer funcionalidades ainda não lançadas.

## 11. Fase 7 — login com Google

### 11.1 Objetivo

Reduzir atrito sem criar duas contas para o mesmo titular.

### 11.2 Riscos que devem ser resolvidos

- e-mail do Google já vinculado a conta por senha;
- conta Google com e-mail diferente do usado no pagamento;
- usuário autenticado sem tenant;
- tentativa de assumir loja de outro e-mail;
- recuperação de acesso quando o Google estiver indisponível;
- callbacks diferentes entre localhost, preview e produção.

### 11.3 Abordagem recomendada

- usar Supabase Auth como fonte única de identidade;
- vincular identidades somente após comprovação segura;
- preservar login por e-mail e senha como alternativa;
- não associar tenant apenas pelo e-mail recebido do navegador;
- testar troca de provedor, logout, callback inválido e conta existente.

## 12. Fase 8 — integração com Instagram

Separar três ideias diferentes:

1. apenas exibir e abrir o perfil — já suportado;
2. compartilhar produtos e links no Instagram — pode usar recursos nativos do dispositivo;
3. sincronizar catálogo/Instagram Shopping — depende de Meta Business, permissões, revisão do aplicativo e políticas externas.

Antes de escolher o escopo avançado:

- confirmar APIs e permissões vigentes da Meta;
- avaliar custo operacional e suporte;
- definir quem é responsável pela conta Business;
- planejar renovação e revogação de tokens;
- documentar falhas de sincronização;
- evitar tornar a publicação da loja dependente da Meta.

Recomendação: começar pelo compartilhamento simples e medir demanda antes de integração de catálogo.

## 13. Fase 9 — avaliação de teste gratuito

Esta é uma decisão de negócio, não apenas uma mudança de tela.

### Hipóteses

- 3 dias: menor abuso, pouco tempo para cadastrar catálogo;
- 7 dias: melhor ativação, maior risco de contas descartáveis;
- sem cartão: menor barreira, menor conversão automática;
- com cartão: maior compromisso, mais atrito e responsabilidade de comunicação.

### Antes de implementar

- medir abandono atual do checkout;
- definir o que acontece com loja e dados ao terminar o teste;
- limitar uma avaliação por pessoa/empresa sem coletar dados excessivos;
- criar comunicação clara de prazo;
- definir recuperação e contratação após expiração;
- adaptar termos e privacidade;
- impedir que webhook de assinatura conflite com estado de trial.

Não implementar teste gratuito sem métricas mínimas do funil atual.

## 14. Refinamentos de experiência já identificados

### Troca de URL sem atualização perceptível

O problema de cadeia de redirecionamentos já foi corrigido. O refinamento futuro pode:

- manter URL e ferramentas de compartilhamento em um estado compartilhado;
- atualizar QR Code, copiar link e “Abrir loja” imediatamente;
- substituir `router.refresh()` por atualização otimista confirmada pelo servidor;
- usar tags de cache por tenant e slug;
- preservar mensagens de erro e rollback visual.

### Painel

- avaliar cabeçalhos e ações fixas apenas quando houver ganho real;
- manter filtros na URL para compartilhamento e retorno;
- adicionar ordenação de produtos se houver demanda;
- melhorar estados vazios com links de próximo passo;
- observar se usuários encontram assinatura, privacidade e compartilhamento no menu mobile.

### Catálogo

- medir abandono entre abrir produto, adicionar ao carrinho e enviar pedido;
- considerar persistência local curta do carrinho somente após avaliar expectativa do usuário;
- considerar campo de observação por item e observação geral;
- não transformar o catálogo em checkout de vendas sem novo escopo jurídico e financeiro.

## 15. Métricas de produto recomendadas

Sem armazenar PII, acompanhar:

- visitantes da landing;
- cliques em “Quero minha loja”;
- início e conclusão de cada etapa do cadastro;
- abertura do checkout;
- pagamento confirmado;
- primeira entrada no painel;
- primeira categoria e primeiro produto;
- primeira publicação com logo/banner;
- primeiro compartilhamento;
- primeiro pedido individual ou consolidado;
- cancelamentos, reversões e reativações;
- falhas por etapa e tempo aproximado até ativação.

As métricas devem responder perguntas de produto, não apenas aumentar volume de dados.

## 16. Matriz de testes para toda release relevante

### Larguras

- 375 px — celular;
- 768 px — tablet;
- 1024 px — notebook pequeno;
- 1440 px ou mais — desktop.

### Navegadores prioritários

- Chrome/Android;
- Safari/iPhone quando houver dispositivo disponível;
- Chrome desktop;
- Edge desktop.

### Estados de dados

- loja nova sem categoria;
- categoria sem produto;
- loja pequena;
- loja com mais de 12 produtos;
- categoria com mais de 20 produtos;
- mais de 8 categorias;
- produtos com e sem imagem/descrição/variação;
- assinatura ativa, atrasada, cancelamento agendado e cancelada;
- loja sem logo/banner;
- nomes e descrições próximos ao limite máximo.

### Qualidade automatizada

Antes de cada commit de release:

```powershell
npm run verify
npm audit --omit=dev
git diff --check
```

Quando houver migration:

- atualizar `supabase/schema.sql`;
- adicionar arquivo incremental numerado;
- atualizar `supabase/verify-setup.sql`;
- atualizar tipos em `src/types/database.ts`;
- adicionar invariantes/testes;
- executar a migration antes do código dependente;
- guardar o resultado da verificação sem dados sensíveis.

## 17. Definition of Done

Uma entrega somente está pronta quando:

- escopo e comportamento esperado estão claros;
- código reutiliza o design system e padrões existentes;
- mobile e desktop foram verificados;
- áreas de toque têm pelo menos aproximadamente 44 px;
- carregamento, sucesso, vazio e erro foram considerados;
- navegação por teclado e nomes acessíveis foram revisados;
- autorização e isolamento por tenant foram testados;
- dados sensíveis não aparecem em logs ou respostas indevidas;
- migrations, documentação e tipos estão sincronizados;
- lint, tipos, testes, contraste e build passam;
- teste manual principal passa localmente;
- rollback ou mitigação está documentado;
- smoke test em produção foi concluído após o deploy.

## 18. Ordem consolidada recomendada

Revisada em 30/09/2026. O item 1 original (pagamento real controlado) foi substituído pelo acompanhamento do primeiro cliente (seção 3.5). Com segurança, cobrança e atraso resolvidos, o gargalo passa a ser **aquisição de clientes**; o próximo foco ainda será escolhido pelo titular entre:

- **Converter visitantes** *(recomendado)*: `/como-funciona`, exemplos de lojas reais e ajustes na landing para o tráfego da campanha de lançamento;
- **Página individual de produto** (Fase 2, seção 6);
- **Visão interna das lojas**: tela administrativa com lojas, status de pagamento, atrasos e métricas — hoje só consultável no Supabase;
- **Organizar a casa**: itens P2 da seção 3.5.

Ordem de referência depois dessa escolha:

1. Acompanhar o primeiro cliente real (seção 3.5, P0).
2. Monitoramento de erros e alertas.
3. Backup e teste de restauração.
4. Observar e ajustar rate limiting.
5. Página individual de produto com Open Graph e compartilhamento.
6. Vitrine `/lojas` com opt-in e moderação.
7. Banner promocional configurável.
8. Métricas próprias ampliadas e consentimento.
9. Google Analytics e Meta Pixel.
10. Central de ajuda e blog.
11. Login com Google.
12. Compartilhamento e integração gradual com Instagram.
13. Avaliar teste gratuito com base em dados reais.

## 19. Registro de decisões futuras

As decisões já tomadas estão na tabela da seção 3.3; acrescente novas linhas ali. Ao iniciar uma fase, registrar também:

- data;
- problema observado;
- hipótese;
- escopo incluído e excluído;
- alteração de banco necessária;
- riscos;
- métricas de sucesso;
- resultado dos testes;
- commit e deploy correspondente;
- decisão de manter, ajustar ou remover.

Este plano pode evoluir, mas mudanças de prioridade devem preservar as fases de estabilidade, segurança e operação antes de recursos que aumentem tráfego ou complexidade.
