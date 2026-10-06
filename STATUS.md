# Status atual do ClickCatálogo

Revisado em **5 de outubro de 2026**, com o `master` em produção (`clickcatalogo.com`, deploy Netlify) até o PR #20.

- **Histórico de releases e decisões:** `docs/PLANO-POS-LANCAMENTO.md`, seção 3.
- **Plano do cadastro grátis:** `docs/PLANO-MONTA-GRATIS.md`.
- **Operação, publicação e incidentes:** `docs/OPERACAO.md`.
- **Configuração e migrations:** `SETUP.md`.
- **Relatório anterior** (pré-lançamento, até 15/09): histórico do Git deste arquivo.

## Resumo

Catálogo digital para pequenos lojistas venderem pelo WhatsApp. O lojista **monta a loja de graça** e paga **R$ 27/mês** (Asaas, cartão, recorrente) só para publicar. O cliente final monta o carrinho na loja pública e envia o pedido pronto pelo WhatsApp; não há pagamento de produtos dentro da plataforma.

| Área | Estado |
|---|---|
| Cadastro | Gratuito, cria conta com senha e loja em rascunho (`/api/cadastro/criar`). |
| Publicação | Exige e-mail confirmado e ao menos 1 produto; checkout Asaas; o webhook põe a loja no ar. |
| Lojas reais em produção | `atelie-aurora` (vitrine) e `justo-shop`; `justo-store` é rascunho de teste do titular. |
| Primeiro pagamento real pelo fluxo de publicação | Ainda não ocorreu (será confirmado pela primeira cliente). |
| Banco | Migrations até `202610020030_store_brand_click_metric.sql` aplicadas em produção. |
| Qualidade | 98 testes (`npm test`), lint, TypeScript, contraste AA e build no CI (`npm run verify` + `npm audit --omit=dev`). |
| Framework | Next.js 16.3.8 (App Router, `proxy.ts`), React 19, Tailwind 4, Zod 4, Supabase, Asaas, Resend, Netlify. |

## Fluxos

### Lojista
1. **Cadastro** (`/cadastro`): nome da loja, WhatsApp, e-mail, endereço (slug verificado na hora), senha, aceite de Termos e Privacidade (`2026-10-01`), tema. Abre o painel na hora.
2. **Rascunho** (status `rascunho`):
   - o painel mostra a faixa de publicação com o checklist (e-mail confirmado e produto) e o botão "Publicar minha loja";
   - divulgação bloqueada;
   - o link público mostra "Loja em preparação" (`noindex`).
3. **Confirmação de e-mail**: link de uso único, 7 dias (`/cadastro/confirmar-email`), reenviável pela faixa do painel.
4. **Publicar**:
   - o registro do cadastro (`signup_intents`) vira a referência do checkout Asaas;
   - o webhook (`CHECKOUT_PAID`/`PAYMENT_CONFIRMED`) cria a assinatura e põe a loja `ativo`;
   - na volta do checkout aparece "Sua loja está no ar!".
5. **Lembretes** (Scheduled Function `draft-lifecycle`, minuto 45 de cada hora):
   - e-mails nos dias 1, 3 e 7, com texto conforme o progresso;
   - opção de parar em `/lembretes/parar`;
   - os links levam ao login com `?next=` para a tela certa.
6. **Rascunho parado**: excluído 30 dias após o último acesso ao painel, junto com fotos, cadastro e usuário do Auth. O titular também pode excluir na hora em Privacidade.
7. **Assinatura ativa**:
   - painel com loja (abas Loja/Contato/Atendimento/Aparência), categorias, produtos, assinatura e privacidade;
   - card "Sua loja esta semana" com visitas, cliques no WhatsApp e compartilhamentos.
8. **Atraso** (`src/lib/billing/overdue-policy.mjs`):
   - avisos nos dias 1, 6 e 25;
   - loja fora do ar a partir do 8º dia;
   - encerramento no 30º dia.
9. **Cancelamento**:
   - feito no painel, com acesso até o fim do período pago;
   - pode ser desfeito durante esse período;
   - depois vem a retenção de até 30 dias, com antecipação opcional, e a reativação acontece por nova contratação.

### Cliente final (`/loja/[slug]`)
- **Página da loja:** catálogo com ISR de 60 s, busca, categorias, 6 temas e opção "só banner".
- **Atendimento:** selos de pagamento, entrega e horário no rodapé.
- **Carrinho:** em duas etapas (itens → finalizar, com detalhes opcionais) e pedido pronto pelo WhatsApp. Nada é gravado.

### Aquisição
- **Páginas:** landing com faixa "Novo", `/como-funciona` com prints reais e Open Graph próprio.
- **Métricas:** contadores diários agregados sem PII (`product_metrics_daily`), lidos com `supabase/funnel-report.sql`. O relatório soma todos os escopos e cobre visita → cadastro → loja criada → e-mail → produto → pagamento, além dos cliques no crédito das lojas.
- **Redes sociais:**
  - Instagram `@justotecnologias` e página do Facebook, agendados pelo Metricool;
  - artes e legendas em `marketing/` (fora do Git).

## Rotas

| Tipo | Rotas |
|---|---|
| Públicas | `/`, `/como-funciona`, `/cadastro`, `/cadastro/confirmar-email`, `/lembretes/parar`, `/loja/[slug]`, `/termos`, `/privacidade`, `/atendimento` |
| Acesso | `/painel` (login, aceita `?next=/painel/...`), `/painel/problemas-para-entrar`, `/painel/recuperar-senha`, `/painel/nova-senha`, `/painel/acessar-loja` (+ `confirmar`, `continuar`), `/auth/callback`, `/auth/confirmar-recuperacao` |
| Painel | `/painel/loja`, `/painel/categorias`, `/painel/produtos`, `/painel/assinatura`, `/painel/privacidade` |
| Compatibilidade (fluxo pago antigo) | `/cadastro/sucesso`, `/cadastro/continuar`, `/cadastro/recuperar` (+ `confirmar`) |
| APIs | `/api/cadastro/criar`, `/api/cadastro/validar-conta`, `/api/conta/confirmar-email`, `/api/lembretes/parar`, `/api/slug-disponivel`, `/api/analytics`, `/api/atendimento`, `/api/webhooks/asaas`; do fluxo antigo: `/api/cadastro/{status,definir-senha,recuperar,recuperar/confirmar,continuar-checkout,checkout-retornado}` |

## Rotinas agendadas (Netlify)

| Função | Horário | O que faz |
|---|---|---|
| `finalize-subscription-cancellations` | minuto 15 | Conciliação de cancelamentos, atraso (avisos 1/6/25, encerramento no 30º dia), fim de períodos pagos |
| `draft-lifecycle` | minuto 45 | Lembretes de rascunho (dias 1/3/7), exclusão de rascunhos parados, limpeza de tokens de confirmação |

## Pendências conhecidas

- **Primeira publicação paga:** acompanhar de ponta a ponta (checklist P0 em `docs/PLANO-POS-LANCAMENTO.md`, seção 3.5).
- **Aquisição:** tráfego ainda baixo (cerca de 4 visitas por dia no início de outubro). Próximos passos são os convites diretos com o modelo grátis e a medição de origem das visitas (`?origem=`).
- **Vercel:** o projeto antigo `catalogo-ja` continua conectado ao GitHub e falha em todo PR. Desconectar na Vercel.
- **Dependências bloqueadas pelo ecossistema:**
  - TypeScript 7, porque o `typescript-eslint` ainda não o suporta;
  - ESLint 10, porque o plugin React da configuração do Next quebra.
  - O Dependabot ignora majors de `typescript`, `eslint` e `@types/node` até haver suporte.
- **Monitoramento e testes:** ainda faltam monitoramento de exceções e alerta para Scheduled Functions atrasadas, além de testes E2E.
