# Checklist de pré-lançamento do ClickCatálogo

Atualizado em 6 de setembro de 2026. Marque cada item somente depois de validar no ambiente público.

## Bloqueios antes de receber o primeiro cliente real

- [x] Executar `supabase/migrations/202608290006_prelaunch_hardening.sql` no Supabase atual.
- [x] Executar, na ordem, `202608300007_fix_distributed_rate_limit.sql` e `202608300008_legal_acceptance_versions.sql`.
- [x] Executar `202608300009_privacy_retention_and_deletion.sql` antes do deploy que contém a área de privacidade.
- [x] Aplicar as migrations `202609120014_require_reconciliation_before_finalization.sql` e `202609120015_claim_cancellation_reconciliation.sql` no Supabase de Produção.
- [ ] Aplicar `202609120016_account_continuation_checkout_lease.sql` antes do deploy do fluxo “Acessar minha loja”.
- [x] Executar `supabase/verify-setup.sql` novamente e confirmar onze tabelas, dezenove funções, o bucket `produtos`, o rate limiting distribuído e os três indicadores de cancelamento como `true`.
- [x] Publicar o commit auditado e confirmar que o workflow **Qualidade** passou no GitHub.
- [x] Apontar `clickcatalogo.com` para a Netlify e validar o certificado HTTPS para o domínio raiz e `www`.
- [x] Trocar `NEXT_PUBLIC_SITE_URL` na Netlify para `https://clickcatalogo.com`. A publicação da versão auditada é validada no item acima.
- [x] Atualizar Site URL e Redirect URLs no Supabase Auth para o domínio final, incluindo o callback completo da recuperação.
- [x] Atualizar e auditar a URL do webhook Sandbox no Asaas para `https://clickcatalogo.com/api/webhooks/asaas`.
- [x] Remover o nome antigo do webhook; configuração auditada como `ClickCatalogo Sandbox` no painel do Asaas.
- [x] Criar a API Key e o webhook no Asaas Produção, mantendo-os secretos e o webhook inativo até a troca final da Netlify.
- [x] Trocar `ASAAS_API_KEY` pela chave de Produção e manter `ASAAS_WEBHOOK_TOKEN` secreto.
- [ ] Confirmar no webhook de Produção o tipo de envio **SEQUENTIALLY**, fila ativa e eventos descritos no `SETUP.md`.
- [ ] Abrir um checkout de produção sem concluir o pagamento e confirmar o valor oficial de R$ 27.
- [ ] Fazer uma contratação real controlada, conferir webhook, tenant, assinatura e acesso; eventual estorno deve ser tratado diretamente no Asaas.
- [ ] Cancelar uma assinatura controlada e conferir Asaas, Supabase, painel e loja pública.

## E-mail e acesso

- [x] SMTP Resend configurado no Supabase e recuperação funcional.
- [x] `contato@clickcatalogo.com` recebe pelo ImprovMX e envia pelo Resend com DKIM e TLS validados no Gmail.
- [x] Aplicar o template em português e validar recebimento, callback, troca de senha e novo login no Gmail.
- [ ] Depois do deploy final, reaplicar `docs/supabase-email-templates/recovery.html` com a etapa intermediária resistente a scanners.
- [ ] Validar a recuperação também em um endereço Outlook.
- [x] Confirmar que SPF, DKIM e DMARC continuam válidos após as alterações de DNS desta rodada.

## Segurança e operação

- [x] Gerar e cadastrar a mesma `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` em `.env.local` e na Netlify antes do deploy final.
- [x] Manter `DEMO_ACCESS_ENABLED=true` conscientemente: a demonstração pública faz parte do lançamento e permanece somente leitura.
- [x] Rodar `npm run verify` e `npm audit --omit=dev` antes desta release; repetir se houver nova alteração de código.
- [x] Rodar `npm run audit:live` depois de aplicar a migration `202608300009`; repetir após os testes de pagamento em Produção.
- [ ] Depois do deploy candidato, executar **Run now** em `finalize-subscription-cancellations` e confirmar log sem erro, duração abaixo de 30 segundos e `unresolved_count` conhecido.
- [ ] Conferir semanalmente falhas de Function na Netlify, erros do Supabase e fila do webhook no Asaas.
- [ ] Configurar alertas de consumo e orçamento na Netlify, Supabase, Resend e Asaas.
- [x] Definir rotina de exportação/backup compatível com o plano Supabase Free em `docs/OPERACAO.md`.
- [ ] Rotacionar a chave Sandbox do Asaas que foi compartilhada durante a configuração e atualizar os ambientes que ainda usem esse valor; nunca reutilizá-la em Produção.

## Decisões de produto e legais ainda necessárias

- [x] Uma conta administra uma loja; um segundo checkout com o mesmo e-mail é bloqueado.
- [x] Configurar `LEGAL_BUSINESS_NAME`, `LEGAL_TAX_ID`, `LEGAL_POSTAL_ADDRESS` e `LEGAL_SUPPORT_EMAIL` na Netlify; a confirmação pública será repetida após o deploy final.
- [x] Definir e implementar os prazos de retenção para intenções, webhooks, contas canceladas, registros técnicos e evidências legais.
- [x] Implementar o procedimento self-service de exclusão, fila auditável, simulação e executor com confirmação forte.
- [ ] Obter revisão jurídica dos textos antes de tráfego pago ou escala comercial.

## Critério de liberação

O lançamento real está liberado apenas quando todos os itens de **Bloqueios**, **E-mail e acesso** e **Segurança e operação** estiverem concluídos. Decisões legais não devem ser preenchidas com dados fictícios.
