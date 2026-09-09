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

## Aplicação

Quando o projeto Supabase existir, vincule o CLI ao projeto e execute:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

O fluxo com CLI é uma alternativa para ambientes já vinculados. Para o novo projeto atual, use o schema consolidado pelo SQL Editor.

## Decisões de segurança

- O navegador não pode inserir tenants nem alterar status de tenant/assinatura.
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
