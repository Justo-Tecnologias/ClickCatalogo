# Banco Supabase

## Projeto novo

Para um Supabase vazio, a opção recomendada é executar uma única vez:

```text
supabase/schema.sql
```

Depois execute `supabase/verify-setup.sql`, que apenas confere tabelas, RLS, funções, bucket e policies.

Não execute o schema consolidado e as migrations individuais no mesmo projeto.

## Histórico de migrações

O arquivo `migrations/202607180001_initial_schema.sql` cria:

- tenants, categorias, produtos e assinaturas;
- intenções de cadastro anteriores ao pagamento;
- registro idempotente de eventos do Asaas;
- validações, chaves estrangeiras e índices;
- RLS para isolamento por proprietário;
- função pública segura `get_public_catalog(slug)`;
- bucket público `produtos`, com escrita limitada ao proprietário e arquivos de até 2 MB.

O arquivo `migrations/202607190002_functional_screens.sql` adiciona a função pública mínima usada para diferenciar lojas canceladas de slugs inexistentes, sem expor produtos nem dados privados.

O arquivo `migrations/202607190003_normalize_brazil_whatsapp.sql` normaliza números brasileiros antigos e passa a exigir o formato canônico `55 + DDD + número`, somente com dígitos.

O arquivo `migrations/202608060004_asaas_customer_lookup.sql` adiciona o índice usado pela reconciliação idempotente de eventos do Asaas por cliente, mantendo `asaas_subscription_id` como identificador exclusivo da assinatura.

O arquivo `migrations/202608280005_expire_stale_signup_intents.sql` libera slugs de checkouts pendentes vencidos mesmo quando o evento `CHECKOUT_EXPIRED` não chega. Em bancos que já receberam o schema antes desta migration, execute somente este arquivo complementar no SQL Editor.

O arquivo `migrations/202608290006_prelaunch_hardening.sql` fecha os pontos da auditoria pré-lançamento: uma loja por usuário, bloqueio de checkout duplicado por e-mail, reordenação atômica de categorias e rate limiting distribuído entre as Functions da Netlify.

O arquivo `migrations/202608300007_fix_distributed_rate_limit.sql` corrige a colisão do identificador `current_time` com uma palavra reservada do PostgreSQL. Em um banco que já recebeu o schema ou as migrations anteriores, execute este arquivo depois do hardening e confirme o resultado `allowed = true`.

O arquivo `migrations/202608300008_legal_acceptance_versions.sql` registra qual versão dos Termos e da Política de Privacidade foi aceita em cada checkout. Execute-o depois da correção do rate limiting e confirme que os dois contadores finais retornam zero.

O arquivo `migrations/202608300009_privacy_retention_and_deletion.sql` registra a data real de cancelamento, cria a fila auditável de exclusão, isola as evidências legais mínimas e adiciona as RPCs restritas à `service_role` usadas pela rotina de retenção. Execute-o depois da migration de aceites legais. A migration não apaga dados existentes.

O arquivo `migrations/202609100010_prelaunch_continuity.sql` muda o cancelamento self-service para o fim do período já pago. Ele registra a data limite de acesso, protege o catálogo caso o agendador atrase e cria a RPC idempotente chamada de hora em hora pela Scheduled Function da Netlify. Execute-o depois da migration de retenção, antes do deploy desta versão.

O arquivo `migrations/202609300023_restrict_tenant_slug_update.sql` retira `slug` da lista de colunas que o titular autenticado pode alterar diretamente em `tenants`. A troca de endereço continua disponível somente pela RPC `change_tenant_slug`, que preserva histórico, aliases protegidos e reservas de cadastro. Execute `audit-slug-integrity.sql` (somente leitura) antes e depois dela.

O arquivo `migrations/202609300024_auth_user_lookup_by_email.sql` cria a RPC `find_auth_user_id_by_email`, restrita à `service_role`, usada pelo webhook para localizar um usuário do Auth pelo e-mail sem paginar a base inteira. Enquanto ela não estiver aplicada, o webhook usa a paginação antiga como plano B.

O arquivo `migrations/202609300025_overdue_suspension_policy.sql` implementa a política de atraso: `subscriptions.overdue_since` guarda o vencimento não pago; `get_public_catalog` deixa a loja indisponível a partir do 8º dia (`get_public_store_status` devolve `suspenso`); `claim_overdue_notices` reserva os avisos dos dias 1, 6 e 25; `claim_overdue_cancellations` e `finalize_overdue_cancellation` encerram a assinatura no 30º dia, depois que a Scheduled Function inativa a recorrência e remove as cobranças abertas no Asaas. Todas as RPCs novas são restritas à `service_role`. Os números devem permanecer alinhados com `src/lib/billing/overdue-policy.mjs`.

O arquivo `migrations/202610010026_marketing_page_metrics.sql` acrescenta as visitas da landing (`landing_view`) e de `/como-funciona` (`how_it_works_view`) à lista fechada de métricas agregadas. A lista do banco precisa ser idêntica a `productMetricNames` em `src/lib/analytics/events.ts`; um teste confere isso. O relatório `funnel-report.sql` (somente leitura) mostra o funil dos últimos 30 dias.

O arquivo `migrations/202610010027_store_service_info.sql` acrescenta as informações de atendimento da loja em `tenants`: `formas_pagamento` (`pix`, `credito`, `debito`, `dinheiro`), `entrega_modo` (`entrega`, `retirada`, `ambos`), `entrega_observacao` (até 120 caracteres) e `horario_atendimento` (até 80). O titular pode editá-las diretamente; `get_public_catalog` passa a devolvê-las. Os valores precisam permanecer alinhados com `src/lib/catalog/store-info.ts`. Aplique antes do deploy do código.

O arquivo `migrations/202610010028_banner_only_header.sql` acrescenta `tenants.banner_somente` (padrão `false`): com ele marcado, a loja mostra o banner inteiro, sem nome, logo e degradê por cima. O site só aplica a opção quando há banner. O titular pode editá-la; `get_public_catalog` passa a devolvê-la. Aplique antes do deploy do código.

## Aplicação

Quando o projeto Supabase existir, vincule o CLI ao projeto e execute:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

O fluxo com CLI é uma alternativa para ambientes já vinculados. Para o novo projeto atual, use o schema consolidado pelo SQL Editor.

## Decisões de segurança

- O navegador não pode inserir tenants nem alterar status de tenant/assinatura.
- O navegador não altera `tenants.slug` diretamente; a troca exige a RPC `change_tenant_slug`.
- `signup_intents` e `asaas_webhook_events` não possuem políticas para usuários; somente a service role do backend pode acessá-las.
- A loja pública consulta uma função que omite `owner_user_id` e campos operacionais.
- O caminho de upload deve começar por `produtos/{tenant_id}/`; as policies conferem se o usuário autenticado é dono desse tenant.
- Produto e categoria usam uma chave estrangeira composta, impedindo vincular um produto à categoria de outra loja.
- `api_rate_limits` não possui policy de leitura ou escrita; somente a `service_role` chama a RPC atômica e os IPs são armazenados como HMAC.
- `owner_user_id` é único enquanto o painel não oferecer alternância entre várias lojas da mesma conta.

Após aplicar a migração, gere os tipos oficiais do projeto e substitua `src/types/database.ts`:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```
