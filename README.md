# ClickCatálogo

SaaS multi-tenant de catálogo digital para comerciantes divulgarem produtos e receberem pedidos pelo WhatsApp.

## Estado atual

Etapa funcional concluída: landing comercial, cadastro em duas etapas, checkout recorrente, webhook idempotente, acesso por senha, painel completo e catálogo público multi-tenant. Após o pagamento, o cliente cria a senha na própria tela de sucesso. A recuperação de senha está implementada e requer SMTP configurado no Supabase. O design system responsivo oferece seis temas.

As integrações não exigem chaves para o projeto compilar. Os clientes Supabase validam a configuração apenas quando uma operação de banco é executada.

## Requisitos

- Node.js 22 ou superior
- npm 10 ou superior
- Um projeto Supabase (necessário para autenticação, banco e uploads)
- Uma conta Asaas Sandbox (necessária para testar o checkout e os webhooks)
- Uma conta Netlify para publicar a aplicação

## Desenvolvimento local

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Preencha `.env.local` quando as credenciais estiverem disponíveis. Nunca envie esse arquivo para o Git. Sem as chaves, todas as páginas continuam abrindo com estados orientativos, mas login, banco e checkout ficam desativados.

## Rotas principais

- `/`: landing comercial;
- `/cadastro`: dados, slug em tempo real, tema e checkout;
- `/painel`: acesso real por e-mail e senha, recuperação de acesso e demonstração pública;
- `/painel/loja`, `/painel/categorias`, `/painel/produtos`, `/painel/assinatura`;
- `/loja/[slug]`: catálogo público;
- `/api/webhooks/asaas`: sincronização de pagamento e provisionamento.

## Ativação das integrações

1. Em um Supabase novo, execute somente `supabase/schema.sql`. Em um banco já criado, aplique as migrations posteriores na ordem documentada em `supabase/README.md`.
2. Copie `.env.example` para `.env.local` e informe as chaves.
3. No Supabase Auth, adicione `http://localhost:3000/auth/callback` às URLs permitidas em desenvolvimento.
4. Para recuperação de senha em produção, verifique `auth.clickcatalogo.com` no Resend, conecte o SMTP ao Supabase Auth e aplique o modelo em `docs/supabase-email-templates/recovery.html`; nenhuma variável Resend é usada pela aplicação.
5. No Asaas Sandbox, cadastre `https://SEU-DOMINIO/api/webhooks/asaas` e use exatamente o mesmo token de `ASAAS_WEBHOOK_TOKEN`.
6. Para testar webhooks localmente, use uma URL HTTPS pública de túnel e atualize `NEXT_PUBLIC_SITE_URL`.
7. Para publicar, conecte o repositório à Netlify; `netlify.toml` contém as configurações de build.

O webhook trata confirmações, recebimentos, atrasos, cancelamentos e eventos do Checkout. Reentregas são registradas por `event_id`, impedindo provisionamento duplicado.

Os números de WhatsApp são exibidos como `+55 (11) 99999-9999` nos formulários e persistidos como `5511999999999`, formato necessário para os links `wa.me`.

## Verificações

```bash
npm run verify
npm audit --omit=dev
npm run audit:live
```

`npm run verify` executa lint, TypeScript, contraste AA das seis paletas e o build. `audit:live` não altera dados de clientes: confere integridade agregada do Supabase, cria e remove apenas um probe técnico do rate limiting e não imprime chaves nem dados pessoais. A rotina de publicação, monitoramento, backup e incidentes está em `docs/OPERACAO.md`.

## Design system

Tokens, temas e componentes reutilizáveis estão documentados em `docs/design-system.md`. A landing, o painel, o cadastro e a loja pública importam os mesmos controles, cards, estados e componentes de catálogo.

## Banco de dados

O banco completo para um projeto novo está em `supabase/schema.sql`. Consulte `SETUP.md` para Supabase, Netlify, Auth e Asaas, e `docs/OPERACAO.md` para a rotina de produção.
