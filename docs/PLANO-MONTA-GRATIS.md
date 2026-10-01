# Plano — "Monte grátis, pague para publicar"

Planejado em **01/10/2026**, com o titular. A implementação começa depois da semana de manutenção (Dependabot, acompanhamento do primeiro cliente e dívidas curtas). Este documento é a referência; o progresso fica em `docs/PLANO-POS-LANCAMENTO.md`, seção 3.

## 1. Objetivo

Hoje a pessoa paga antes de ver a própria loja: cadastro → checkout Asaas → webhook cria conta, loja e assinatura → criação de senha → painel. Quem não paga some sem deixar contato útil (a reserva expira em 24 h e nenhum e-mail é enviado).

Com o novo fluxo, a pessoa monta a loja de graça. Ela paga só quando quer publicar e recebe lembretes por e-mail se parar no meio.

Indicadores para acompanhar (antes × depois, pelo `funnel-report.sql`):

- cadastros iniciados → contas criadas;
- contas criadas → primeiro produto;
- primeiro produto → publicação (pagamento);
- publicações recuperadas pelos lembretes (clique no e-mail → publicação).

## 2. Decisões do titular (01/10)

| Tema | Decisão |
|---|---|
| Modelo | Monta grátis, paga para publicar. Rascunho não é público, e a cobrança atual não muda (R$ 27/mês pelo checkout Asaas). |
| Conta | Cadastro com e-mail e senha abre o painel na hora. O e-mail de boas-vindas traz o link de confirmação, que só é exigido para publicar. |
| Lembretes | 3 e-mails, nos dias 1, 3 e 7 após o cadastro. O texto acompanha o progresso: sem produtos, "adicione seu primeiro produto"; com produtos, "sua loja está pronta, publique". Os envios param ao publicar. |
| Rascunho parado | Exclusão de conta, loja e fotos 30 dias após o último acesso ao painel. O e-mail do dia 7 e o painel avisam o prazo. |
| Link público do rascunho | Página "Loja em preparação" com o nome da loja e "Em breve", sem produtos e fora do Google. No painel, copiar link e QR Code ficam bloqueados até publicar. |

## 3. Fluxo novo

```
/cadastro (nome, WhatsApp, endereço, tema, e-mail, senha, aceites)
   └─► conta criada + loja "rascunho" + sessão aberta + e-mail de boas-vindas (link de confirmação)
         └─► painel em modo rascunho: faixa "Sua loja está em rascunho", checklist e prévia
               └─► "Publicar minha loja"
                     ├─ e-mail não confirmado → reenviar confirmação e aguardar
                     ├─ sem nenhum produto → orientar a cadastrar ao menos 1
                     └─ checkout Asaas (intenção "publication" ligada à loja)
                           └─► webhook pago → loja "ativo" + assinatura → "Sua loja está no ar!"
```

## 4. Escopo técnico

### 4.1 Banco (migration 029, aplicada antes do deploy)

- `tenants.status` aceita `rascunho`. `get_public_catalog` continua devolvendo somente `ativo` e `inadimplente`, e `get_public_store_status` passa a devolver `rascunho`.
- Novos campos em `tenants`:
  - `draft_last_seen_at`: último acesso ao painel, gravado no máximo 1 vez por hora;
  - `draft_reminder_last_day` (0, 1, 3 ou 7) e `draft_reminder_claimed_at`: controle e reserva dos lembretes;
  - `email_reminders_opt_out`: o lojista pode parar de receber os lembretes.
- `signup_intents.intent_type` aceita `publication` (mesmo padrão de `reactivation`: `target_tenant_id` obrigatório).
- RPCs restritas à `service_role`:
  - `claim_draft_reminders(p_limit)`: reserva os lembretes dos dias 1, 3 e 7 de forma idempotente;
  - `claim_stale_drafts(p_limit)`: rascunhos com `draft_last_seen_at` acima de 30 dias, para exclusão;
  - ajuste em `email_has_tenant` / disponibilidade de endereço para considerar rascunhos.
- Métricas novas, na lista fechada do banco e em `productMetricNames`: `draft_created`, `publish_started`, `store_published` e `draft_reminder_clicked`.
- Validar em PGlite no caminho da produção e na instalação do zero, como nas migrations 025 a 028.

### 4.2 Cadastro e conta

- `/api/cadastro/criar` substitui `/api/checkout/asaas` no cadastro novo:
  - mesmas proteções de hoje: mesma origem, rate limit, validação Zod, endereço e e-mail disponíveis;
  - cria o usuário com `email_confirm: false`, a loja `rascunho` e o registro de aceites (Termos e Privacidade);
  - abre a sessão.
- Formulário de cadastro: entram os campos de senha (o componente `password-fields` já existe). O passo de pagamento sai do cadastro.
- E-mail de boas-vindas pelo Resend, com o link de confirmação gerado pelo Supabase Auth (`generateLink`). Há reenvio pelo painel.
- Checkouts antigos ainda pendentes no dia do deploy continuam funcionando: o webhook mantém `intent_type = 'signup'` por um ciclo de transição.

### 4.3 Painel em rascunho

- Faixa fixa "Sua loja está em rascunho", com o checklist que já existe (`StoreOnboardingChecklist`) e o botão "Publicar minha loja".
- "Divulgação" (copiar link, WhatsApp, QR Code) e "Alterar link" ficam desabilitados, com a explicação "disponível após publicar". A prévia continua disponível.
- Página de assinatura no rascunho: plano, valor e o que acontece ao publicar.
- Aviso de exclusão quando faltarem 7 dias ou menos para o prazo de 30 dias.

### 4.4 Publicação

- `/api/loja/publicar`:
  - exige sessão, loja `rascunho`, e-mail confirmado e ao menos 1 produto ativo;
  - cria uma intenção `publication` e o checkout recorrente;
  - reutiliza a lógica de criação de checkout e de retomada (`continuar-checkout`).
- Webhook: `provisionPublication`, no mesmo formato de `provisionReactivation`. Valida o titular pelo e-mail, cria a assinatura, coloca a loja `ativo`, grava a intenção `pago` e registra `store_published`.
- Tela de retorno "Sua loja está no ar!", com o link e os botões de divulgação.

### 4.5 Lembretes e exclusão (rotina horária existente)

- `finalize-subscription-cancellations.mjs` ganha duas etapas, com orçamento de tempo próprio (limite de 30 s da Netlify):
  - lembretes: `claim_draft_reminders` → e-mail com o conteúdo pelo progresso → chave idempotente por loja e dia;
  - exclusão: `claim_stale_drafts` → remove fotos do Storage, a loja e o usuário do Auth. Reaproveita a exclusão auditável que já existe.
- Os e-mails trazem o botão para o painel (com marcação para medir `draft_reminder_clicked`) e o link "não quero mais receber lembretes".
- Os textos ficam em `src/lib/signup/draft-emails.mjs`, no mesmo padrão de `overdue-emails.mjs`.

### 4.6 Loja pública

- `/loja/[slug]` com status `rascunho`: página "Loja em preparação" (nome, "Em breve", `noindex`). Sem produtos, WhatsApp ou métricas de visita.

### 4.7 Landing, `/como-funciona` e jurídico

- Chamadas: "Criar minha loja grátis" e "Monte grátis, pague só para publicar", no hero, no plano, na chamada final e no CTA fixo do celular.
- FAQ: o que é grátis, quando começa a cobrança, o que acontece com o rascunho parado.
- `/como-funciona`: o passo do pagamento passa a ser "Publique quando estiver pronta".
- Faixa "Novo" (`announcements.ts`) anuncia o modelo depois de publicado.
- Termos e Privacidade em nova versão: rascunho gratuito, lembretes por e-mail com opção de parar e exclusão em 30 dias.
  - **Decisão pendente:** avisar ou não os titulares atuais. Para eles nada muda.

## 5. Riscos e proteções

| Risco | Proteção |
|---|---|
| Cadastros em massa (robôs) | Rate limit do cadastro que já existe. Avaliar Cloudflare Turnstile se aparecer abuso, o que exige decisão e chaves do titular. |
| E-mails para quem não pediu (e-mail de terceiro digitado) | Só boas-vindas + 3 lembretes, com opção de parar. A confirmação é exigida para publicar. |
| Fotos de rascunho ocupando espaço | Exclusão em 30 dias. Avaliar limite de produtos no rascunho se o volume crescer. |
| Loja publicada sem pagar | O catálogo público exige `ativo`/`inadimplente`, e só o webhook pago muda `rascunho` → `ativo`. A permissão de UPDATE do titular não inclui `status`. |
| Transição com checkouts antigos pendentes | O webhook continua aceitando `signup` até as intenções antigas expirarem (24 h). |

## 6. Entregas sugeridas

1. **R1 — rascunho e publicação:** migration 029, cadastro novo, painel em rascunho, publicação, página "Loja em preparação", Termos/Privacidade e métricas.
2. **R2 — lembretes e exclusão:** e-mails dos dias 1, 3 e 7, opção de parar, exclusão em 30 dias e avisos no painel.
3. **R3 — comunicação:** landing, `/como-funciona`, FAQ, faixa "Novo" e ajuste do `funnel-report.sql`.

Cada entrega segue a seção 16 do plano pós-lançamento: testes, PGlite, prints reais, Deploy Preview e migration antes do deploy. O teste ponta a ponta da publicação usa o Asaas Sandbox, sem cobrança real.
