# Variáveis de ambiente — ClickCatálogo

O passo a passo completo está em `C:\Projeto-Github\ClickCatálogo\SETUP.md`. Este arquivo é apenas o mapa rápido das variáveis realmente lidas pelo código.

## Arquivos e painéis

- desenvolvimento local: `C:\Projeto-Github\ClickCatálogo\.env.local`;
- modelo sem segredos: `C:\Projeto-Github\ClickCatálogo\.env.example`;
- deploy: **Netlify → Project configuration → Environment variables**;
- banco: `C:\Projeto-Github\ClickCatálogo\supabase\schema.sql`.

Se o banco atual já recebeu o schema e o hardening anterior, execute, nesta ordem, as migrations `202608300007`, `202608300008` e `202608300009` dentro de `C:\Projeto-Github\ClickCatálogo\supabase\migrations\`.

Nunca grave valores reais em `.env.example`, documentação ou Git.

## Variáveis

| Variável | Origem | Obrigatória | Segredo |
|---|---|---:|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Connect ou Settings → API Keys → Project URL | Sim | Não |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → Publishable key | Sim | Não |
| `NEXT_PUBLIC_SITE_URL` | Local: `http://localhost:3000`; publicado: URL principal da Netlify | Sim | Não |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Segredo aleatório de 32 bytes codificado em base64 | Produção | Sim |
| `DEMO_ACCESS_ENABLED` | Definida pelo projeto: `true` ou `false` | Não | Não |
| `LEGAL_BUSINESS_NAME` | Nome ou razão social do responsável pelo serviço | Antes da primeira venda | Não; será público |
| `LEGAL_TAX_ID` | CPF ou CNPJ do responsável | Antes da primeira venda | Não; será público |
| `LEGAL_POSTAL_ADDRESS` | Endereço físico de atendimento do fornecedor | Antes da primeira venda | Não; será público |
| `LEGAL_SUPPORT_EMAIL` | Caixa de e-mail real que recebe solicitações | Antes da primeira venda | Não; será público |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → Secret key | Para cadastro pago | Sim |
| `ASAAS_API_KEY` | Asaas → Integrações → Chave da API | Para pagamento | Sim |
| `ASAAS_WEBHOOK_TOKEN` | Segredo aleatório criado pelo administrador | Para pagamento | Sim |
| `ASAAS_API_URL` | Compatibilidade com chave antiga | Não | Sim |

As chaves modernas do Supabase usam `sb_publishable_...` e `sb_secret_...`. Os nomes das variáveis foram preservados por compatibilidade com o código atual.

O Resend é conectado diretamente ao SMTP do Supabase Auth. `RESEND_API_KEY` não é lida pela aplicação e não deve ser cadastrada na Netlify nem no `.env.local`. Consulte a seção Resend do `SETUP.md`.

## Modelo local

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=

DEMO_ACCESS_ENABLED=true

LEGAL_BUSINESS_NAME=
LEGAL_TAX_ID=
LEGAL_POSTAL_ADDRESS=
LEGAL_SUPPORT_EMAIL=

SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_API_URL=
```

## Netlify

Na Netlify de produção, use `NEXT_PUBLIC_SITE_URL=https://clickcatalogo.com`, sem barra final. Em instalações de teste separadas, use a URL `*.netlify.app` correspondente.

O `netlify.toml` não fixa essa URL. O painel da Netlify é a fonte única para evitar callbacks presos ao domínio de teste.

Marque `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` como valores secretos. Mudanças em variáveis exigem novo build/deploy. As quatro variáveis `LEGAL_*` são renderizadas nos Termos, na Política de Privacidade e no canal de atendimento do rodapé; use somente dados que possam ser publicados.

## Webhook

O mesmo valor de `ASAAS_WEBHOOK_TOKEN` deve existir em dois lugares:

1. variável secreta na Netlify;
2. campo **Token de autenticação** do webhook no Asaas.

URL atual, tanto para Sandbox quanto para Produção:

```text
https://clickcatalogo.com/api/webhooks/asaas
```
