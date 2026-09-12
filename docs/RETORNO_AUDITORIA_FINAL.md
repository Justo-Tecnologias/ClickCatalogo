# ClickCatálogo — retorno técnico após a terceira auditoria

Data: 12/09/2026
Estado: lote local validado, migrations 014/015 comprovadas em Produção e lote ainda não publicado

## Parecer interno

Os gates de código apontados pela terceira auditoria foram tratados. As migrations
014/015 e suas permissões foram comprovadas em Produção; o ciclo financeiro real
continua sendo o gate manual antes do primeiro cliente externo.

## Correções aplicadas

1. O fim do período pago agora usa a próxima cobrança já gerada ou, se ela ainda
   não existir, o `nextDueDate` validado retornado pela assinatura. Não existe
   mais cálculo próprio de calendário.
2. Somente `CREDIT_CARD` atualmente `CONFIRMED` ou `RECEIVED` comprova pagamento;
   estados manuais, negativação, estorno e chargeback não concedem período.
3. A conciliação remove somente cobranças `PENDING` da assinatura correta com
   vencimento igual ou posterior ao fim do período pago.
4. Depois de cada exclusão, todas as cobranças são listadas novamente. Qualquer
   cobrança remanescente após o corte, inclusive uma que mudou de estado durante
   a operação, produz `attention`; o painel não promete ausência de cobrança.
5. A Scheduled Function da Netlify tenta novamente até dez conciliações
   `pending`/`attention` por hora, sem depender de o titular retornar ao painel.
6. A migration 014 impede a finalização local do cancelamento enquanto a
   conciliação não estiver `complete`.
7. A migration 015 adiciona claim, `processing` e lease; o painel e o agendador
   usam comparação condicional para não disputar com “Desfazer cancelamento”.
8. O fragmento contendo o link de recuperação é capturado e removido
   imediatamente da barra de endereço com `history.replaceState`.
9. A Política de Privacidade agora informa que o IP pode ser processado
   transitoriamente para segurança/rate limiting; somente o HMAC derivado é
   armazenado, por até um dia.
10. Foram adicionados testes de fronteira para ações do painel, criação de senha,
   consumo atômico do token e comportamento da rotina horária.
11. A rotina horária possui orçamento interno de 17 segundos, timeout de 3
   segundos por requisição e seleção justa com cooldown para evitar starvation.
12. Falha ou `404` ao inativar a assinatura não é inferido como sucesso; o item
   permanece para conferência em `attention`.
13. Replays de pagamento não apagam cancelamento agendado, evento antigo de
   inativação não regride assinatura local reativada e evento `ACTIVE` anterior
   ao pedido de reativação é ignorado.

## Decisões justificadas

- `SUBSCRIPTION_CREATED` não foi adicionado como dependência obrigatória. O
  fluxo real já confirmou que `asaas_subscription_id` é persistido a partir dos
  eventos de checkout/pagamento e a auditoria do webhook exige esses eventos.
  O evento pode ser incorporado futuramente como redundância, após validar seu
  contrato em Produção, sem bloquear o lançamento.
- O webhook continua síncrono neste volume inicial. Duração estruturada, lease,
  idempotência e retries permanecem monitorados; fila externa fica condicionada
  a latência ou volume reais.
- A checagem estática confirmou que as ações mutáveis derivam o tenant da sessão
  e restringem operações pelo tenant. O teste SQL A × B continua obrigatório no
  banco real porque testes locais não reproduzem integralmente Auth/RLS/Storage.

## Evidências automatizadas

- ESLint: aprovado;
- TypeScript: aprovado;
- contraste AA: aprovado nos seis temas;
- testes: 35 de 35 aprovados;
- build Next.js: aprovado, 27 rotas/páginas;
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas;
- `git diff --check`: sem erro de whitespace;
- varredura de segredos: somente placeholders e prefixos documentais.

## SQLs novos antes do deploy

Executar no SQL Editor do Supabase:

`supabase/migrations/202609120014_require_reconciliation_before_finalization.sql`

`supabase/migrations/202609120015_claim_cancellation_reconciliation.sql`

Depois, executar `supabase/verify-setup.sql` e confirmar:

`finalizacao_exige_conciliacao_completa = true`

`service_role_pode_reservar_conciliacao = true`

`usuario_nao_pode_reservar_conciliacao = true`

## Testes manuais que ainda não podem ser substituídos

1. cobrança real controlada e persistência de exatamente um tenant/assinatura;
2. cancelamento com uma cobrança futura já gerada;
3. confirmação de `INACTIVE`, corte correto e conciliação `complete`;
4. reversão para `ACTIVE` sem cobrança imediata;
5. recuperação cross-device e rejeição do segundo uso do token;
6. isolamento A × B com duas contas reais;
7. observação dos logs Netlify e Asaas sem 4xx/5xx ou dados sensíveis.

Conclusão recomendada: **GO controlado depois das migrations 014/015, do deploy único
e do teste financeiro dirigido.**
