# ClickCatálogo — auditoria de lançamento

Auditoria realizada em 10 de setembro de 2026 a partir do código da branch `master`, do deploy público, do Supabase conectado e dos três documentos externos entregues para análise.

## 1. Veredito executivo

**Estado atual: NO-GO temporário até aplicar a migration e publicar esta versão; GO para preparar divulgação orgânica.**

O produto está funcional e a estrutura de segurança está consistente. O código desta rodada removeu o preço técnico, preserva o acesso até o fim do período pago, adiciona retomada pós-checkout, validação antecipada da conta, atendimento funcional e ícone próprio. Ainda é obrigatório aplicar a migration, publicar uma única vez e executar o teste financeiro real antes de expor o cadastro ao público.

O lançamento comercial pode mudar para **GO com ressalvas** assim que todos os itens abaixo forem confirmados:

1. checkout de produção abre com o valor oficial de R$ 27;
2. pagamento confirma e o webhook provisiona usuário, tenant e assinatura uma única vez;
3. login, CRUD, catálogo, carrinho e WhatsApp passam no roteiro manual;
4. cancelamento deixa de gerar a renovação, mas preserva o acesso até o fim do período pago;
5. término do período desativa a loja por uma rotina idempotente;
6. a migration `202609100010_prelaunch_continuity.sql` está aplicada;
7. novo deploy é publicado e a Scheduled Function aparece ativa na Netlify;
8. a URL incorreta `sabor-da-vila` não é usada em anúncio, postagem ou demonstração.

A versão de lançamento não lê mais variável de preço de teste: checkout, interface e provisionamento usam o plano oficial de R$ 27 definido no código.

## 2. Evidências verificadas

### Aplicação e produção

- `npm run verify` passou depois da correção do checkout: ESLint, TypeScript, contraste AA dos seis temas e build das 18 rotas;
- workflow **Qualidade** do commit `c68ea03` passou no GitHub;
- `npm run audit:production -- loja-teste-netlify` passou sem falhas;
- landing, cadastro, painel, recuperação, termos, privacidade, robots, sitemap e loja real responderam HTTP 200;
- loja inexistente permanece com `noindex` no comportamento de streaming do Next.js;
- domínio final e callbacks usam `NEXT_PUBLIC_SITE_URL`.

### Banco, isolamento e Storage

A auditoria conectada ao Supabase encontrou:

- 2 tenants, 2 assinaturas, 2 categorias, 2 produtos, 8 intenções e 7 eventos de webhook;
- zero proprietários duplicados;
- zero categorias, produtos ou arquivos órfãos;
- zero intenções pagas sem tenant;
- zero assinaturas ativas sem IDs do Asaas;
- zero webhooks pendentes, com erro ou travados;
- zero solicitações de exclusão vencidas ou travadas;
- rate limiting distribuído e autorização de reordenação respondendo corretamente;
- bucket `produtos` público para leitura, limitado a 2 MB e a JPG, PNG e WebP.

O tenant é derivado da sessão nas Server Actions. As policies de `tenants`, `categories`, `products`, `subscriptions` e Storage restringem escrita ao proprietário; operações financeiras usam service role somente no servidor. A RPC pública do catálogo devolve apenas os dados necessários à loja.

### Dependências

- `npm audit --omit=dev`: zero vulnerabilidades;
- alerta Dependabot aberto para Next.js afeta versões `>=16.0.0 <16.2.11`;
- projeto usa Next.js `16.3.3`, acima da primeira versão corrigida `16.2.11`.

O alerta do GitHub não representa vulnerabilidade ativa na versão instalada, embora possa ser encerrado/atualizado no painel para reduzir ruído operacional.

### Asaas

- integração cria Checkout recorrente no servidor;
- status de pagamento não é confiado ao navegador;
- webhook valida token, registra evento, usa claim idempotente e preserva cancelamento como estado terminal;
- checkout possui timeout e falha segura;
- callbacks apontam para o domínio configurável;
- a falha histórica do checkout foi causada pelo limite do nome do item e já foi corrigida;
- o item de produção usa `Assinatura ClickCatálogo` e o preço oficial de R$ 27;
- a remoção da recorrência é idempotente e o acesso local permanece até a próxima data de renovação informada pelo Asaas.

A chave local permanece Sandbox; a chave de Produção está somente na Netlify. A validação financeira completa em Produção continua manual e obrigatória.

## 3. Análise dos documentos externos

### Recomendações corretas e urgentes

1. **Pesquisar a marca no INPI e buscar orientação especializada.** Existe outro produto no mesmo nicho usando `ClickCatálogo` em `clickcatalogo.net`. Isso cria risco real de confusão comercial, SEO e disputa marcária. Pesquisa comum na internet não substitui busca de anterioridade nem parecer jurídico.
2. **Não anunciar uma demo inconsistente.** `/loja/sabor-da-vila` contém no banco um tenant chamado ScannerTec. Metadados e conteúdo retornam o mesmo tenant; não há sinal de vazamento entre lojas. O problema é reaproveitamento de slug/dados.
3. **Medir o funil antes de tráfego pago.** Hoje não há analytics. Divulgação orgânica controlada pode começar após o go-live, mas investimento relevante em mídia não deve começar sem instrumentação e política de privacidade atualizada.
4. **Criar testes automatizados.** Não há suíte unitária, integração ou E2E. CI, auditorias e roteiro manual reduzem o risco, mas não substituem regressão automatizada.
5. **Adicionar compartilhamento e Open Graph visual.** É uma evolução pequena, coerente com o produto e já está planejada como a primeira release pós-lançamento.

### Itens que já estão implementados

Os prompts tratam estes pontos como pendentes, mas o repositório atual já possui:

- autenticação e recuperação pelo Supabase/Resend;
- isolamento multi-tenant por RLS, sessão e FK composta;
- Storage com namespace por tenant, validação de arquivo, tamanho, formato, dimensões e decodificação;
- rate limiting distribuído no Supabase com fallback local;
- webhook Asaas autenticado, idempotente e resiliente a reentrega;
- bloqueio de segundo tenant para o mesmo usuário/e-mail;
- busca client-side por nome e descrição com debounce;
- paginação `Carregar mais` por categoria;
- carrinho completo em memória e pedido consolidado pelo WhatsApp;
- variação informativa em texto livre;
- ocultação/reativação de produto pelo campo `ativo`;
- bloqueio de exclusão de categoria com produtos;
- metadata dinâmica por loja, canonical, robots e sitemap;
- `next/image`, lazy loading, proporções fixas e fallbacks;
- seis temas com contraste AA;
- demonstração local, separada e somente leitura;
- cancelamento self-service, retenção e solicitação de exclusão;
- estados de carregamento, erro, vazio e timeout nos fluxos principais;
- documentação de setup, operação, pré-lançamento e teste de produção.

Reimplementar esses itens a partir dos prompts seria retrabalho e poderia introduzir regressões.

### Recomendações válidas, mas não bloqueantes para lançamento controlado

- QR Code da loja;
- compartilhar loja e produto;
- imagem Open Graph por loja e Twitter Card;
- onboarding com indicador de completude;
- central de ajuda, FAQ e página Como funciona;
- vitrine de lojas com adesão voluntária;
- importação CSV/Excel;
- analytics de produto;
- páginas individuais de produto e dados estruturados;
- observabilidade dedicada como Sentry;
- refinamento da mensagem do WhatsApp com nome/observações;
- testes E2E automatizados.

### Itens que não devem ser feitos antes de divulgar

- IA para cadastro;
- Pix para venda dos produtos do lojista;
- Meta Pixel configurável por tenant;
- API oficial do WhatsApp;
- estoque/PDV;
- Bling/ERP;
- afiliados e white-label;
- domínio próprio por tenant;
- marketplace;
- trial ou mudança de planos/preço.

Esses itens alteram posicionamento, banco, cobrança, privacidade ou suporte. Devem ser validados por demanda real, não incorporados em uma corrida pré-lançamento.

## 4. Problemas reais classificados

### CRÍTICO — migration de continuidade ainda precisa ser aplicada

**Local:** `supabase/migrations/202609100010_prelaunch_continuity.sql`.

**Risco:** publicar o novo código antes das novas colunas e da RPC causa falha na tela de assinatura e no cancelamento.

**Ação:** executar a migration no SQL Editor, rodar `supabase/verify-setup.sql` e somente então publicar.

### ALTO — cobrança real ainda não validada ponta a ponta

**Local:** Checkout e webhook Asaas Produção.

**Risco:** receber um pagamento e não liberar acesso, duplicar estado ou falhar no cancelamento.

**Ação:** executar integralmente as seções 3, 4 e 13 de `docs/TESTE_PRODUCAO_HOJE.md`.

### ALTO — possível conflito comercial e marcário

**Local:** nome ClickCatálogo e presença de `clickcatalogo.net` no mesmo segmento.

**Risco:** confusão de público, perda de busca, oposição ou necessidade futura de rebranding.

**Ação:** fazer busca exata e radical no INPI, verificar classes aplicáveis e consultar profissional de propriedade intelectual antes de investir em mídia, materiais ou registro.

### MÉDIO — demo `sabor-da-vila` inconsistente

**Local:** registro real no Supabase.

**Evidência:** slug `sabor-da-vila`, nome `ScannerTec`, status ativo. Página e metadata são consistentes entre si.

**Risco:** perda de confiança se essa URL for apresentada como loja de alimentação.

**Ação imediata:** não divulgar essa URL. Usar temporariamente `/loja/cafe-da-praca-demo`, que é uma demonstração local estável e somente leitura. Planejar demos permanentes e protegidas sem editar dados reais às pressas.

### MÉDIO — ausência de analytics

**Local:** aplicação e Política de Privacidade.

**Risco:** não medir abandono, ativação e resultado de campanha.

**Ação:** começar apenas com divulgação orgânica/manual. Antes de tráfego pago, escolher uma única ferramenta, definir eventos mínimos e atualizar a Política de Privacidade. Um clique no WhatsApp é uma intenção, não confirmação de pedido ou venda.

### MÉDIO — ausência de testes automatizados

**Local:** repositório sem arquivos de teste/Playwright.

**Risco:** regressões futuras em autenticação, tenant, carrinho e billing dependerem de validação manual.

**Ação:** após estabilizar o primeiro pagamento, criar testes de contrato do webhook e E2E dos fluxos sem cobrança real.

### BAIXO — apresentação social incompleta

**Local:** metadata da loja.

**Estado:** título, descrição, canonical, site name e URL já existem; imagem social/Twitter Card não.

**Ação:** implementar na Release A pós-lançamento junto com compartilhar loja.

## 5. Plano para começar divulgação

### Bloco A — concluir antes de publicar qualquer CTA hoje

- [ ] migration `202609100010_prelaunch_continuity.sql` aplicada e verificada;
- [ ] nova versão publicada uma única vez na Netlify;
- [ ] checkout real abre com `Assinatura ClickCatálogo` e R$ 27;
- [ ] pagamento é confirmado;
- [ ] webhook entrega 2xx e não duplica registros;
- [ ] senha, login e painel funcionam;
- [ ] criar categoria e produto, editar loja e abrir catálogo;
- [ ] carrinho envia mensagem correta ao WhatsApp;
- [ ] cancelamento real sincroniza Asaas e Supabase;
- [ ] logs de Netlify, Supabase e Asaas estão limpos.

### Bloco B — restaurar a oferta comercial

- [ ] confirmar que `ASAAS_CHECKOUT_TEST_VALUE` não existe na Netlify;
- [ ] abrir novo checkout com e-mail/slug controlados;
- [ ] confirmar R$ 27 e nome `Assinatura ClickCatálogo`;
- [ ] sair/cancelar o checkout sem pagar;
- [ ] confirmar que a intenção expira/cancela sem tenant;
- [ ] executar `npm run audit:production -- <slug-ativo>` e `npm run audit:live`;
- [ ] confirmar recuperação de senha após o deploy final;
- [ ] não usar `sabor-da-vila` como demonstração.

### Bloco C — divulgação permitida hoje

Depois de A e B, iniciar com alcance controlado:

- contatos próprios e indicação direta;
- grupos relevantes em que divulgação seja permitida;
- Instagram/WhatsApp orgânico;
- oferecer ajuda manual para montar as primeiras lojas;
- usar somente números, lojas e depoimentos reais;
- coletar feedback dos primeiros 5 a 10 lojistas;
- registrar origem do contato manualmente enquanto analytics não existe.

Não iniciar tráfego pago relevante hoje. Primeiro resolver marca, analytics e uma demonstração comercial permanente.

## 6. Próximas releases, sem inflar o MVP

### Release A — conversão e compartilhamento

1. botão Compartilhar loja;
2. Web Share API e copiar link;
3. Open Graph 1200 × 630 por loja;
4. Twitter Card;
5. QR Code local para loja;
6. demo oficial permanente e coerente.

### Release B — medição e confiança

1. ferramenta única de analytics;
2. eventos de landing, início de cadastro, checkout, ativação e clique no WhatsApp;
3. atualização da Política de Privacidade;
4. FAQ e Como funciona;
5. error monitoring;
6. testes de contrato e E2E essenciais.

Não registrar `first_order` como fato: o sistema hoje só sabe que o cliente clicou para abrir o WhatsApp. O evento honesto é `whatsapp_order_clicked`.

### Release C — ativação

1. checklist de completude da loja;
2. importação simples CSV/Excel;
3. melhorias de variação baseadas em pedidos reais;
4. central de ajuda;
5. vitrine pública com consentimento do lojista.

IA, pagamento de produtos e integrações avançadas permanecem roadmap, condicionados ao comportamento dos primeiros clientes.

## 7. Posicionamento recomendado

Proposta central:

> O catálogo mais simples para quem vende pelo WhatsApp.

Mensagem de dor a testar organicamente:

> Pare de mandar foto e preço um por um. Seu cliente escolhe no catálogo e o pedido chega organizado no WhatsApp.

Não prometer loja pronta em cinco minutos enquanto não houver medição real de onboarding. Não afirmar quantidade de pedidos, clientes ou vendas sem fonte verificável.

## 8. Decisão final

**Agora:** NO-GO até aplicar a migration, publicar e concluir o teste financeiro desta versão.

**Depois dos blocos A e B:** GO COM RESSALVAS para lançamento orgânico controlado.

**Antes de tráfego pago:** resolver pesquisa de marca, analytics/privacidade, demo comercial permanente e testes automatizados essenciais.
