# ClickCatálogo — runbook da release de lançamento

Atualizado em 12/09/2026. Este documento descreve a release que ainda está no
worktree local. Publique somente depois de concluir os bloqueadores abaixo, em
um único push, para evitar builds desnecessários na Netlify.

## Resultado da auditoria

### P0 coberto pelo código desta release

- retomada do cadastro em outro navegador ou dispositivo por link de uso único;
- jornada única “Acessar minha loja”, com roteamento servidor entre primeira
  senha, login, checkout, confirmação, reativação e novo cadastro;
- token de retomada com 256 bits de entropia, somente hash no banco, expiração
  de 20 minutos e consumo atômico;
- reaproveitamento de checkout ainda válido, sem gerar cobrança duplicada;
- cancelamento reversível: a recorrência é inativada no Asaas e a loja continua
  publicada até o fim do período pago;
- fim do período pago derivado da próxima cobrança já gerada; quando ela ainda
  não existe, usa o `subscription.nextDueDate` validado como fronteira remota;
- somente cobrança `CREDIT_CARD` atualmente `CONFIRMED` ou `RECEIVED` comprova
  o período pago; recebimento manual, negativação, estorno e chargeback não;
- conciliação das cobranças futuras já geradas pelo Asaas, removendo somente as
  pendentes a partir do fim do período pago, relendo a lista antes de concluir e
  sinalizando qualquer corrida ou falha no painel;
- nova tentativa automática horária das conciliações `pending`/`attention`, sem
  depender de o titular voltar ao painel;
- claim atômico, estado `processing`, lease de dois minutos e CAS nas gravações
  para impedir corrida entre agendador, retry e “Desfazer cancelamento”;
- orçamento interno de 17 segundos na Scheduled Function, abaixo do limite fixo
  de 30 segundos da Netlify, com seleção justa pelo último processamento;
- desistência do cancelamento antes do vencimento, sem cobrar novamente o
  período já pago;
- renovação de assinatura legada/cancelada vinculada ao tenant existente, sem
  criar outra loja ou outro usuário;
- idempotência e lease de processamento do webhook, inclusive para reentregas e
  execução concorrente;
- estados fora de ordem de inadimplência não derrubam uma assinatura mais nova;
- máscara brasileira de preço sem alterar o tipo numérico persistido;
- logs estruturados e sanitizados, sem senha, token, chave, e-mail ou WhatsApp;
- duração do processamento registrada nos logs estruturados do webhook;
- métricas próprias diárias e agregadas, sem evento individual, IP ou PII;
- política de privacidade alinhada ao envio transacional pelo Resend e às
  métricas agregadas, com versionamento atualizado do aceite;
- compartilhamento da loja por Web Share, copiar link, WhatsApp e QR Code;
- Open Graph dinâmico por loja, sem buscar imagem remota no servidor;
- checklist de publicação no painel e FAQ na landing;
- suíte automatizada para contratos financeiros, estados, moeda, token e
  invariantes do schema.

### Riscos residuais aceitos para lançamento controlado

- o webhook é processado de forma síncrona antes do `200`; uma fila externa só
  passa a ser necessária quando o volume justificar;
- não existe troca de cartão, reembolso ou upgrade/downgrade dentro do produto;
- ainda não existe painel administrativo global;
- o teste E2E completo com cobrança real não roda no CI e deve ser feito uma vez,
  de forma controlada, depois do deploy;
- Outlook e revisão jurídica profissional são recomendações antes de escalar a
  divulgação, mas não alteram o funcionamento técnico da primeira venda.

## Bloqueadores antes do único push

1. Confirmar que `supabase/migrations/202609120013_cancellation_payment_reconciliation.sql`
   permanece aplicada e executar
   `supabase/migrations/202609120014_require_reconciliation_before_finalization.sql`
   e `supabase/migrations/202609120015_claim_cancellation_reconciliation.sql`
   e `supabase/migrations/202609120016_account_continuation_checkout_lease.sql`
   no Supabase de Produção.
2. Rodar `supabase/verify-setup.sql` e confirmar que não há item ausente.
3. Rodar `supabase/test-launch-critical.sql` e confirmar a mensagem `ok`; o
   script executa em transação e faz `rollback`, portanto não deixa dados.
   Com duas lojas de proprietários diferentes, rodar também
   `supabase/test-multitenant-isolation.sql` e confirmar a mensagem `OK`.
4. Confirmar na Netlify, em Production, sem compartilhar os valores:
   - `NEXT_PUBLIC_SITE_URL=https://clickcatalogo.com`;
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
   - `SUPABASE_SERVICE_ROLE_KEY`;
   - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` estável;
   - `ASAAS_API_KEY` com prefixo de Produção;
   - `ASAAS_WEBHOOK_TOKEN` igual ao token cadastrado no webhook de Produção;
   - `RESEND_API_KEY` restrita a envio;
   - `RESEND_FROM_EMAIL=ClickCatálogo <contato@clickcatalogo.com>`;
   - `LEGAL_BUSINESS_NAME`, `LEGAL_TAX_ID`, `LEGAL_POSTAL_ADDRESS` e
     `LEGAL_SUPPORT_EMAIL`.
5. Confirmar no Asaas de Produção que o webhook
   `https://clickcatalogo.com/api/webhooks/asaas` está ativo e inclui os eventos
   de checkout, pagamento e assinatura documentados no `SETUP.md`, inclusive
   `PAYMENT_DELETED` e `SUBSCRIPTION_UPDATED`, com tipo de envio
   **SEQUENTIALLY (sequencial)** e fila de sincronização ativa.
6. Executar localmente `npm run verify` e `npm audit --omit=dev`.

## Teste dirigido depois do deploy

Use um e-mail controlado e uma loja descartável identificada como teste.

1. Abra `/cadastro`, valide e-mail/slug antes da etapa de tema e conclua uma
   cobrança real de menor risco permitida pelo plano vigente.
2. Feche a tela de sucesso antes de criar a senha. Em outro navegador, abra
   `/painel/acessar-loja`, solicite o link, confirme que ele abre a intenção certa
   e que o segundo uso do mesmo link é rejeitado.
3. Crie a senha, entre no painel e confirme que existe exatamente um usuário,
   um tenant e uma assinatura para a contratação.
4. Cadastre categoria, produto e imagem; edite, inative e reative o produto.
5. Abra a loja em 375, 768, 1024 e 1440 px. Confira banner, logo, duas colunas no
   mobile, compartilhamento, QR Code, carrinho e pedido consolidado no WhatsApp.
6. Programe o cancelamento. Confirme no Asaas o estado `INACTIVE`, que a data
   final local corresponde a um ciclo depois da cobrança liquidada mais recente,
   ausência de cobrança a partir desse corte, estado `complete` no painel e
   continuidade da loja durante o período já pago.
7. Use **Desfazer cancelamento** e confirme `ACTIVE`, sem nova cobrança e com a
   mesma próxima data de vencimento.
8. Para uma assinatura legada já removida, use **Renovar assinatura** e confirme
   que o pagamento reativa o mesmo tenant, sem duplicação.
9. Reenvie um evento já processado pelo Asaas e confirme resposta idempotente,
   sem novo tenant ou assinatura local.
10. Confira logs da Function e do Asaas usando somente IDs técnicos; nenhum
    segredo ou dado pessoal deve aparecer.

## Critérios de aprovação

- `npm run verify` e `npm audit --omit=dev` passam;
- migrations, verificação e teste SQL passam;
- uma cobrança real provisiona exatamente uma loja;
- recuperação cross-device, cancelamento e reversão funcionam;
- nenhum erro 5xx inesperado aparece nos logs;
- callback, e-mails e links usam `https://clickcatalogo.com`;
- navegação principal e catálogo funcionam nos quatro tamanhos de tela.

## Rollback

Se houver regressão de interface ou aplicação, restaure na Netlify o deploy
anterior. As migrations desta release são aditivas e devem permanecer: não faça
rollback destrutivo do banco. Pause a divulgação, mantenha o webhook ativo para
não perder eventos financeiros e processe/reentregue os eventos falhos depois
da correção. Se a falha estiver no Asaas, não altere assinaturas manualmente sem
antes conciliar o `externalReference`, o tenant e a assinatura local.

## Depois do lançamento controlado

1. monitorar erros, latência, fila do webhook e métricas agregadas por 48 horas;
2. validar entrega de recuperação no Outlook;
3. adicionar testes de integração contra um projeto Supabase efêmero;
4. implementar painel administrativo global e alertas operacionais;
5. evoluir rate limiting/filas somente quando as métricas indicarem necessidade;
6. executar revisão jurídica profissional dos documentos e processo de dados;
7. priorizar vitrine de lojas, central de ajuda/blog, página de produto e
   integrações de marketing já registradas no planejamento do produto.
