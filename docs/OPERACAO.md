# Operação do ClickCatálogo

Rotina mínima para manter o serviço estável no lançamento. Este documento não contém chaves, senhas nem dados de clientes.

## Antes de cada publicação

1. Trabalhe e valide todas as mudanças localmente antes de criar um único commit de release.
2. Use Node.js 22 ou superior e execute:

   ```powershell
   npm run verify
   npm audit --omit=dev
   ```

3. Confira o diff e confirme que `.env.local`, dumps, imagens de clientes e arquivos de backup não serão versionados.
4. Publique somente após aprovação explícita.

## Depois de cada publicação

1. Aguarde o deploy da Netlify terminar e confirme que a versão publicada corresponde ao commit esperado.
2. Execute a auditoria pública com o slug de uma loja de teste:

   ```powershell
   npm run audit:production -- loja-teste-netlify
   ```

3. Abra `https://clickcatalogo.com` em uma janela anônima e valide:
   - landing, Termos e Privacidade;
   - login e recuperação de senha;
   - catálogo público, pedido individual e carrinho;
   - painel protegido sem sessão.
4. Confira em **Netlify → Deploys → último deploy → Functions** se apareceram erros novos.

## Rotina diária durante o pré-lançamento

- **Netlify:** conferir falhas de Functions, deploys e consumo do plano.
- **Supabase:** conferir erros em **Logs**, usuários inesperados em **Authentication → Users** e crescimento anormal de banco/Storage.
- **Asaas:** conferir entregas do webhook, cobranças pendentes e eventos com falha.
- **Resend:** conferir entregas, rejeições e reclamações de spam dos e-mails de autenticação.
- Nunca copiar payloads completos com e-mail, telefone, token ou chave para issue, chat ou repositório público.

## Auditoria semanal do ambiente real

Com o `.env.local` apontando para o projeto de produção e usando Node.js 22 ou superior:

```powershell
npm run audit:live
npm run audit:asaas
npm run audit:production -- loja-teste-netlify
npm audit --omit=dev
```

O `audit:live` confere apenas contagens e integridade agregada dos dados de clientes. Ele também valida as funções de autorização e o rate limiting distribuído, criando e removendo um probe técnico, sem imprimir credenciais ou dados pessoais. O `audit:asaas` consulta somente a lista de webhooks da conta correspondente à chave local e mostra um resumo sanitizado; não imprime API Key, token de autenticação, e-mail do alerta nem payloads financeiros.

## Backup no Supabase Free

O plano Free não inclui backups automáticos. Faça uma exportação lógica semanal e antes de qualquer migration. Guarde o resultado em uma pasta privada, criptografada e fora deste repositório.

1. No Supabase, abra **Project Settings → Database** e copie a connection string da conexão direta. Troque o marcador da senha pela senha real do banco.
2. Instale ou execute a Supabase CLI em um ambiente confiável.
3. Em uma pasta privada de backup, defina a conexão apenas na sessão atual e gere três arquivos:

   ```powershell
   $clickCatalogoDbUrl = Read-Host "Cole a connection string do Supabase"
   supabase db dump --db-url "$clickCatalogoDbUrl" -f roles.sql --role-only
   supabase db dump --db-url "$clickCatalogoDbUrl" -f schema.sql
   supabase db dump --db-url "$clickCatalogoDbUrl" -f data.sql --data-only --use-copy
   Remove-Variable clickCatalogoDbUrl
   ```

4. Digitar a conexão pelo `Read-Host` evita gravá-la no histórico do terminal. Não coloque esse valor em `.env.example`, GitHub Actions, logs ou commits.
5. Registre a data, verifique que os três arquivos não estão vazios e mantenha pelo menos quatro cópias semanais.

O dump do banco preserva tabelas e metadados, mas **não contém os arquivos do bucket `produtos`**. Faça também uma cópia privada das imagens do Storage. Uma restauração deve recriar o bucket/policies pelo `supabase/schema.sql`, restaurar os dados e reenviar os objetos preservando os caminhos `{tenant_id}/...`.

O projeto inclui um utilitário somente de leitura para baixar as imagens. Informe uma pasta privada fora do repositório:

```powershell
npm run backup:storage -- --output "D:\Backups-Privados\ClickCatalogo"
```

Cada execução cria uma subpasta datada, preserva toda a árvore do bucket (inclusive subpastas e eventuais objetos órfãos) e gera um `manifest.json` com tamanho e hash SHA-256 de cada arquivo. O comando recusa destinos dentro do repositório para reduzir o risco de publicar dados de clientes por engano.

Backups também contêm dados pessoais. Mantenha-os criptografados, com acesso restrito e rotação máxima de 30 dias para os dados operacionais. Nunca restaure um backup diretamente em produção sem reconciliar as solicitações de exclusão concluídas depois da data daquele backup; dados já eliminados não podem voltar a ficar disponíveis ao cliente ou ao público.

## Antes de migrations

1. Gere um backup novo.
2. Leia o SQL inteiro e confirme que ele é idempotente ou possui uma estratégia de avanço segura.
3. Rode no SQL Editor do projeto correto.
4. Execute `supabase/verify-setup.sql` e `npm run audit:live`.
5. Nunca use `db reset` contra o projeto remoto de produção.

## Retenção e exclusão de dados

Os prazos implementados são:

- registros técnicos de rate limiting: um dia depois do vencimento;
- intenções de checkout canceladas ou expiradas e sem tenant: 90 dias;
- payloads de webhook processados sem erro: 180 dias;
- catálogo, imagens, configurações e Auth de conta cancelada: 30 dias, ou até 15 dias quando o titular pede antecipação;
- evidências mínimas de contratação, aceite e pagamento: cinco anos contados do arquivamento;
- eventos de webhook ainda falhos não são apagados automaticamente.

A migration `supabase/migrations/202608300009_privacy_retention_and_deletion.sql` precisa estar aplicada antes de usar os comandos abaixo. A rotina é manual nesta fase do lançamento e deve ser executada diariamente por um operador autorizado.

1. Primeiro rode somente a simulação:

   ```powershell
   npm run privacy:purge
   ```

   A simulação é somente leitura, não lista e-mail, telefone, nome de loja, Auth ID ou conteúdo e informa quantos registros estão elegíveis.

2. Se houver exclusões de conta vencidas, confirme no Asaas que as assinaturas estão canceladas e revise o estado `cancelado` no Supabase.
3. Execute em lote pequeno:

   ```powershell
   npm run privacy:purge -- --execute --confirm=PURGAR-DADOS-CANCELADOS --limit=10
   ```

4. Guarde a saída do comando em registro operacional privado. Os IDs exibidos identificam solicitações técnicas, não clientes, e permitem demonstrar conclusão ou investigar falhas.
5. Se uma solicitação falhar, o executor mantém o estado `falhou`, grava um motivo limitado a 500 caracteres, agenda nova tentativa em seis horas e interrompe novas tentativas automáticas depois de cinco falhas. Investigue antes de reabrir a fila.
6. A ordem de exclusão é fixa: validar tenant/assinatura, arquivar evidência mínima, apagar Storage do tenant, apagar intenção de cadastro, apagar tenant com dados em cascata, apagar usuário Auth e marcar a solicitação concluída. Não faça essa sequência manualmente fora de um incidente documentado.

Antes de automatizar o comando em agendador externo, mantenha o modo de simulação por pelo menos uma semana e configure alerta para qualquer execução com `failed > 0`. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em argumento de linha de comando, log ou repositório.

## Incidentes

### Checkout ou webhook falhando

1. Não repita manualmente o provisionamento sem consultar `signup_intents`, `asaas_webhook_events`, `tenants` e `subscriptions`.
2. Confira primeiro o evento no Asaas e depois o log da Function na Netlify.
3. Preserve o `event_id`: a idempotência depende dele para impedir processamento duplicado.
4. Se uma chave apareceu em local público, rotacione-a no provedor e atualize a Netlify antes de novo deploy.

### Catálogo ou painel indisponível

1. Verifique o status do último deploy e das Functions na Netlify.
2. Verifique disponibilidade, logs e limites do Supabase.
3. Valide `clickcatalogo.com`, HTTPS e DNS antes de alterar código.
4. Registre horário, rota, mensagem e identificador técnico; não registre dados pessoais desnecessários.

### Suspeita de acesso indevido

1. Revogue a sessão do usuário no Supabase Auth.
2. Rotacione somente a credencial potencialmente exposta.
3. Consulte logs de Auth, banco, Netlify e Asaas para delimitar o período e o impacto.
4. Preserve evidências e procure orientação jurídica se houver possível incidente com dados pessoais.

## Testes controlados antes da primeira venda

- uma cobrança real de R$ 27;
- confirmação do tenant e da assinatura no Supabase;
- criação de senha, login, edição e publicação de produto;
- recuperação de senha em Gmail e Outlook;
- pedido individual e carrinho pelo WhatsApp;
- cancelamento self-service e confirmação no Asaas, Supabase, painel e loja pública.

Use uma conta e uma loja exclusivas para esse teste. Não reutilize a loja que será apresentada como demonstração.
