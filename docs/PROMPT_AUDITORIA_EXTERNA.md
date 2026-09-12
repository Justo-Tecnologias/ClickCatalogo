# Prompt para auditoria externa completa do ClickCatálogo

Copie todo o conteúdo abaixo e envie ao ChatGPT, Claude ou outro revisor técnico. Não envie arquivos `.env`, chaves, tokens, dados de cartão, payloads reais de clientes ou identificadores pessoais.

---

Você é um grupo de revisão formado por:

- engenheiro de software sênior especialista em SaaS multi-tenant;
- arquiteto de Next.js, Supabase/PostgreSQL e aplicações serverless na Netlify;
- especialista em integrações financeiras e webhooks do Asaas;
- especialista em segurança de aplicações web e prevenção de abuso;
- especialista em produto, experiência de onboarding e operação de micro-SaaS;
- revisor de privacidade e práticas aplicáveis a um produto brasileiro sujeito à LGPD.

Faça uma auditoria crítica, independente e pragmática do sistema descrito abaixo. O objetivo é lançar para os primeiros clientes reais com baixo custo operacional, sem transformar o MVP em uma plataforma grande demais.

Não presuma que uma funcionalidade existe apenas porque seria desejável. Diferencie claramente:

1. o que está implementado;
2. o que está parcialmente implementado;
3. o que é uma lacuna confirmada;
4. o que é apenas evolução futura;
5. o que exige confirmação no código, banco ou painel de terceiros.

Não recomende reescrita, microsserviços, Kubernetes ou infraestrutura cara sem demonstrar uma necessidade concreta. Para cada recomendação, informe risco evitado, esforço aproximado, dependências, custo operacional e como testar.

## 1. Produto e modelo de negócio

O produto chama-se **ClickCatálogo** e usa o domínio `https://clickcatalogo.com`.

É um SaaS brasileiro para pequenos lojistas criarem um catálogo público e receberem pedidos organizados pelo WhatsApp. O ClickCatálogo não processa o pagamento dos produtos vendidos pelo lojista e não confirma se a venda foi concluída. O cliente final monta o pedido no catálogo e abre uma mensagem consolidada no WhatsApp da loja.

Oferta atual:

- plano único de R$ 27 por mês;
- cobrança recorrente por cartão de crédito no Asaas;
- sem comissão sobre as vendas do lojista;
- produtos e categorias sem limite comercial definido;
- seis temas visuais;
- edição de loja, logo, banner, produtos e categorias;
- cancelamento self-service;
- demonstração separada e somente leitura.

O projeto é operado inicialmente por uma única pessoa e deve permanecer viável nos planos gratuitos ou de baixo custo da Netlify, Supabase e Resend durante a validação comercial.

## 2. Stack e hospedagem

- Next.js 16 com App Router;
- React 19 e TypeScript;
- Tailwind CSS e componentes próprios;
- Supabase Postgres, Auth e Storage;
- RLS em todas as tabelas pertencentes a tenants;
- Netlify com adaptação automática de Next.js/OpenNext;
- Asaas para checkout e assinatura recorrente;
- Resend configurado como SMTP do Supabase Auth;
- domínio e DNS gerenciados externamente;
- imagens públicas no bucket Supabase Storage `produtos`;
- `next/image` para banner, logo e produtos;
- ISR de 60 segundos no catálogo público.

O pipeline executa ESLint, TypeScript, auditoria de contraste dos seis temas e `next build`. A última verificação local terminou sem erros e `npm audit --omit=dev` retornou zero vulnerabilidades conhecidas.

## 3. Rotas e experiência existentes

### Públicas

- `/`: landing comercial com temas, demonstração, preço, CTAs e rodapé;
- `/cadastro`: formulário em duas etapas, dados da loja e escolha de tema;
- `/cadastro/sucesso?ref=...`: aguarda webhook, mostra links e permite criar a primeira senha;
- `/cadastro/continuar`: retoma a confirmação usando referência da URL ou cookie seguro;
- `/painel`: login por e-mail e senha, com opção de demonstração;
- `/painel/recuperar-senha` e `/painel/nova-senha`: recuperação via Supabase Auth e SMTP Resend;
- `/loja/[slug]`: catálogo público;
- `/termos`, `/privacidade` e `/atendimento`;
- `/auth/callback` e rotas intermediárias de recuperação resistentes a prefetch.

### Painel autenticado

- `/painel/loja`: nome, descrição, WhatsApp, Instagram, endereço, tema, logo e banner;
- `/painel/categorias`: criar, editar, ordenar e excluir quando não existem produtos vinculados;
- `/painel/produtos`: criar, editar, ocultar, reativar e excluir produtos e imagens;
- `/painel/assinatura`: status, valor, próxima cobrança, fatura e cancelamento;
- `/painel/privacidade`: informações de retenção e solicitação de exclusão antecipada.

### APIs principais

- `GET /api/slug-disponivel`;
- `POST /api/cadastro/validar-conta`;
- `POST /api/checkout/asaas`;
- `GET /api/cadastro/status`;
- `POST /api/cadastro/definir-senha`;
- `POST /api/webhooks/asaas`.

## 4. Fluxo de cadastro e pagamento atual

1. O visitante informa nome da loja, WhatsApp, e-mail, slug e aceita Termos e Privacidade.
2. O slug é consultado com debounce.
3. Antes da etapa de tema, o backend verifica se o e-mail já possui tenant ou intenção ativa.
4. Ao continuar para o Asaas, o servidor valida tudo novamente.
5. Uma linha é criada em `signup_intents` antes do checkout. Ela guarda os dados mínimos do cadastro, versões dos aceites, referência externa aleatória, expiração, IDs do Asaas, status e tenant provisionado.
6. O servidor cria um Checkout Asaas recorrente de R$ 27 e grava o ID retornado.
7. Somente depois da criação bem-sucedida do checkout, a aplicação grava um cookie HTTP-only, `SameSite=Lax`, seguro em produção e válido por 48 horas com a referência de retomada.
8. O navegador é redirecionado ao checkout hospedado pelo Asaas.
9. O retorno visual não confirma pagamento. O webhook autenticado é a fonte de verdade.
10. Ao receber pagamento confirmado, o backend provisiona ou encontra o usuário do Supabase Auth, cria o tenant e a assinatura e marca a intenção como paga.
11. A tela de sucesso consulta o status e permite definir a senha uma única vez usando a referência e o mesmo e-mail da contratação.
12. Depois de configurar a senha, o cookie de retomada é removido.

Proteções existentes:

- validação Zod no cliente e servidor;
- checagem de mesma origem nos POSTs públicos;
- rate limiting distribuído no Supabase, com fallback local;
- referência de cadastro em UUID aleatório;
- senha só pode ser criada depois de pagamento confirmado e conferência do mesmo e-mail;
- bloqueio de um segundo tenant para o mesmo usuário/e-mail;
- expiração de intenções antigas;
- nenhuma chave financeira é enviada ao navegador.

## 5. Lacuna confirmada: retomada em outro dispositivo

No mesmo navegador, fechar a aba ou perder a internet é tratado pelo cookie e por `/cadastro/continuar`.

Em outro dispositivo ou após perder o cookie:

- se o webhook já provisionou o usuário, a pessoa pode usar a recuperação de senha do Supabase Auth;
- se o checkout ainda está pendente ou o webhook ainda não provisionou o usuário, não existe uma jornada clara de retomada;
- não é seguro consultar apenas o e-mail e devolver a referência, pois isso permitiria enumeração e acesso indevido ao estado do cadastro;
- essa lacuna tende a gerar suporte e pode induzir o cliente a tentar pagar novamente.

Avalie e desenhe uma solução de recuperação por e-mail que:

- funcione antes e depois do webhook;
- responda de forma genérica para não revelar se o e-mail existe;
- envie link de uso único e curta duração;
- armazene somente hash do token, expiração, consumo e auditoria mínima;
- aplique rate limit por IP e por hash normalizado do e-mail;
- invalide tokens anteriores quando necessário;
- nunca envie a referência bruta em logs ou analytics;
- leve o cliente ao estado correto: retomar checkout, aguardar pagamento, criar senha ou entrar no painel;
- evite pagamento duplicado;
- use Resend diretamente apenas se isso for justificável, considerando que hoje ele está conectado somente como SMTP do Supabase Auth.

Compare pelo menos estas abordagens:

1. endpoint próprio + Resend API + token de retomada com hash no banco;
2. antecipar a criação do usuário no Supabase Auth antes do pagamento e usar OTP/magic link;
3. limitar a recuperação por e-mail ao estado pós-pagamento e oferecer outra estratégia para checkout pendente.

Indique a opção recomendada, ameaças, migration necessária, estados da interface e testes de abuso.

## 6. Cancelamento atual

O cancelamento implementado hoje:

1. exige sessão autenticada e digitação exata do nome da loja;
2. consulta no Asaas a `nextDueDate` da assinatura;
3. registra `cancel_at_period_end`, `cancellation_requested_at` e `access_until`;
4. executa `DELETE /subscriptions/{id}` no Asaas para impedir futuras recorrências;
5. trata a remoção como idempotente e repete uma vez em falha de comunicação;
6. ignora o evento `SUBSCRIPTION_DELETED` como cancelamento imediato quando ainda existe período pago;
7. mantém tenant, painel e loja ativos até `access_until`;
8. uma Scheduled Function da Netlify chama uma RPC idempotente de hora em hora;
9. vencido o acesso, assinatura e tenant tornam-se cancelados, `canceled_at` é registrado e começa a retenção operacional de até 30 dias;
10. o catálogo possui proteção adicional no SQL para não permanecer público se a rotina atrasar.

Esse fluxo foi testado e funcionou, mas `DELETE` remove definitivamente a recorrência no Asaas. A documentação do Asaas também oferece `status=INACTIVE`, que interrompe novas cobranças e permite reativação posterior com `status=ACTIVE` e uma nova `nextDueDate`.

## 7. Lacuna confirmada: reativação sem perder a loja

O cliente pode se arrepender do cancelamento. A loja não deve ser perdida durante a retenção, e a reativação não pode:

- criar outro tenant;
- duplicar categorias, produtos ou usuário;
- cobrar duas vezes pelo mesmo período;
- reativar por causa de webhook financeiro antigo;
- prometer recuperação depois que a retenção e o expurgo já eliminaram os dados.

Avalie uma arquitetura compatível com dois grupos:

### Assinaturas canceladas depois da nova solução

Considerar trocar o cancelamento Asaas de `DELETE` para `status=INACTIVE`, mantendo o registro local como cancelamento agendado. Antes de `access_until`, um botão **Desfazer cancelamento** poderia reativar a mesma assinatura com `status=ACTIVE` e `nextDueDate=access_until`, sem cobrança sobreposta.

### Assinaturas antigas já removidas com DELETE

Precisam de um novo checkout/assinatura ligado ao tenant existente. O webhook deve reconhecer uma intenção de reativação e atualizar o tenant correto, sem executar o fluxo de criação de loja.

Analise também:

- reativação antes do fim do período pago;
- reativação depois do fim do período, mas dentro dos 30 dias de retenção;
- reativação durante uma solicitação de exclusão ainda cancelável;
- reativação depois que a exclusão começou ou terminou;
- nova cobrança imediata versus próxima data futura;
- confirmação explícita antes de qualquer cobrança;
- cartão inválido ou assinatura sem token reutilizável;
- concorrência entre reativação, Scheduled Function e webhook;
- idempotência de clique duplo e reentrega de evento;
- estados locais recomendados e histórico financeiro auditável;
- se `INACTIVE` atende juridicamente à promessa de “cancelar quando quiser” ou se a interface precisa explicar melhor a diferença entre interromper cobrança, excluir dados e reativar.

Entregue uma máquina de estados proposta para assinatura e tenant, incluindo transições permitidas e proibidas.

## 8. Slug atual e troca de URL

Hoje o slug é escolhido no cadastro, salvo em `tenants.slug`, validado como único e não pode ser alterado no painel. Portanto, a ausência dessa opção é uma funcionalidade ainda não implementada, não um erro da interface.

Existe uma política preliminar planejada:

- confirmação explícita e validação de palavras reservadas;
- limite de uma troca a cada 90 dias;
- somente o slug atual e o imediatamente anterior podem ter efeito;
- redirecionamento do slug anterior por 90 dias;
- quarentena por mais 30 dias;
- liberação para reutilização por outro cliente após 120 dias;
- histórico permanente apenas para auditoria, sem reservar o slug para sempre;
- ao liberar ou reutilizar um slug, qualquer redirecionamento antigo deixa de funcionar;
- atualização de canonical, sitemap, Open Graph e caches;
- risco residual aceito: links muito antigos podem abrir uma nova loja depois da reutilização do slug.

Revise essa política e proponha:

- schema e constraints;
- operação transacional segura;
- resolução da rota antiga;
- prevenção de ciclos e cadeias de redirects;
- corrida entre troca e novo cadastro;
- política para slugs de lojas canceladas ou excluídas;
- UX e avisos ao lojista;
- critérios de liberação e reuso;
- impacto em SEO, cache ISR e links compartilhados.

## 9. Banco e multi-tenancy

Tabelas principais:

- `tenants`;
- `categories`;
- `products`;
- `subscriptions`;
- `signup_intents`;
- `asaas_webhook_events`;
- tabelas de rate limit;
- fila de exclusão de conta;
- retenção legal mínima.

Regras importantes:

- `tenants.owner_user_id` liga a loja ao Supabase Auth;
- categoria e produto possuem `tenant_id`;
- uma FK composta impede produto de apontar para categoria de outro tenant;
- RLS restringe leitura e escrita do painel ao proprietário;
- status financeiros não são editáveis pelo navegador;
- service role é usada somente no servidor;
- RPC pública retorna apenas dados necessários do catálogo;
- Storage usa prefixo `{tenant_id}/` e policies de escrita do proprietário;
- bucket é público apenas para leitura das imagens do catálogo.

Audite riscos de IDOR, bypass de RLS, uso incorreto de service role, funções `security definer`, search path, enumeração, concorrência, isolamento de arquivos e vazamento por cache.

## 10. Webhook e cobrança

O webhook:

- valida `asaas-access-token` com comparação segura;
- valida estrutura mínima do payload;
- registra o evento por ID;
- usa claim atômico com lease para evitar processamento concorrente;
- retorna evento repetido sem reprovisionar;
- localiza intenção por referência externa, checkout, assinatura ou cliente;
- trata pagamento confirmado/recebido, checkout pago, atraso, assinatura removida/inativada e checkout cancelado/expirado;
- evita reativar tenant terminal por evento financeiro atrasado;
- registra erro para reprocessamento;
- não aceita o retorno visual do checkout como prova de pagamento.

Audite eventos faltantes, ordem de eventos, retries, poison messages, timeout, reconciliação, observabilidade, rotação de token, divergência entre Asaas e banco e recuperação manual segura.

## 11. Catálogo, painel e imagens

Catálogo público:

- busca aparece somente acima de 12 produtos;
- busca client-side por nome e descrição, debounce de aproximadamente 300 ms;
- até 20 produtos iniciais por categoria e botão **Carregar mais**;
- categorias sticky apenas em catálogos maiores;
- dois cards por linha no mobile;
- cards com largura integral, imagem 1:1 e fallback temático;
- banner 21:9, `object-fit: cover`, overlay e altura mobile limitada;
- logo 1:1 com fallback;
- carrinho somente em memória;
- pedido individual e pedido consolidado pelo WhatsApp;
- loja inadimplente não revela ao comprador o motivo financeiro;
- loja cancelada fica indisponível;
- metadata dinâmica, canonical, sitemap e `noindex` para inexistentes;
- ainda não existe imagem Open Graph dinâmica por loja nem Twitter Card completo.

Uploads:

- limite de 2 MB no bucket;
- JPG, PNG e WebP;
- compressão no navegador;
- validação de MIME, assinatura binária, dimensões, pixels, animação e decodificação no servidor;
- remoção do arquivo antigo após substituição/exclusão.

Audite performance, custo, cache, acessibilidade, SEO, disponibilidade do Storage, arquivos órfãos, conteúdo abusivo e limites práticos de produtos/categorias.

## 12. Segurança e privacidade

Controles existentes:

- CSP e headers de segurança;
- proteção contra iframe e MIME sniffing;
- validação de origem;
- rate limit compartilhado no Supabase com HMAC do IP; operações públicas sensíveis falham fechadas e webhook/rotas leves mantêm fallback em memória;
- cookies HTTP-only, `SameSite=Lax` e `Secure` em produção;
- Server Actions derivam tenant da sessão;
- dados financeiros e chaves somente no servidor;
- recuperação de senha sem revelar se a conta existe;
- documentos legais com identificação do fornecedor configurada por ambiente;
- versões de aceite de Termos e Privacidade armazenadas;
- retenção operacional de até 30 dias após fim do serviço;
- retenção legal mínima separada por prazo documentado;
- executor de expurgo em modo simulação por padrão.

Pontos conhecidos:

- ainda não existe suíte automatizada E2E ou de contrato do webhook;
- ainda não existe error tracking dedicado como Sentry;
- analytics e Meta Pixel ainda não foram instalados;
- não existe consentimento de cookies/analytics porque essas ferramentas ainda não são usadas;
- recuperação cross-device da intenção ainda não existe;
- expurgo exige rotina operacional controlada e não deve apagar dados sem auditoria.

Avalie OWASP, abuso, enumeração, CSRF, XSS por conteúdo do lojista, SSRF por URLs, upload malicioso, credential stuffing, brute force, segredo em logs, supply chain, backups, restauração, incidentes e LGPD. Classifique achados por criticidade e diferencie risco comprovado de hipótese.

## 13. Funcionalidades planejadas, ainda não implementadas

- recuperação cross-device do cadastro;
- reativação self-service preservando tenant;
- troca de slug com histórico temporário;
- máscara monetária brasileira no preço do produto;
- botão de compartilhar loja;
- imagem Open Graph 1200 × 630 por loja e produto;
- QR Code;
- página individual de produto;
- vitrine `/lojas` com adesão voluntária;
- FAQ, `/como-funciona`, central de ajuda e blog;
- onboarding/checklist de completude;
- analytics do funil e Meta Pixel com consentimento adequado;
- login Google com vínculo seguro à conta existente;
- eventual teste gratuito sem cartão;
- banner promocional interno separado da capa;
- integração futura com Instagram/Meta;
- importação CSV/Excel;
- testes automatizados de contrato e E2E.

Não trate essas funcionalidades como bloqueadoras automaticamente. Avalie impacto no lançamento, suporte, receita e risco.

## 14. Decisões que a auditoria deve responder

Responda obrigatoriamente:

1. O sistema pode receber os primeiros clientes reais agora? Dê veredito `GO`, `GO COM RESSALVAS` ou `NO-GO`.
2. Quais achados são realmente bloqueadores de lançamento?
3. A recuperação cross-device deve entrar antes da divulgação ou pode ter mitigação temporária?
4. Qual desenho de token e envio de e-mail evita enumeração e pagamento duplicado?
5. O cancelamento deve mudar de `DELETE` para `INACTIVE` no Asaas?
6. Como reativar antes do fim do período sem cobrança sobreposta?
7. Como reativar depois do fim do período, mas antes da exclusão dos dados?
8. Como tratar assinaturas legadas que já foram removidas por `DELETE`?
9. Quais estados adicionais são necessários no banco, se houver?
10. A política de slug 90 + 30 dias está equilibrada?
11. Quais testes automatizados mínimos oferecem maior redução de risco?
12. Qual observabilidade mínima e barata deve existir na primeira semana?
13. Quais métricas podem ser coletadas sem enviar PII?
14. Quais textos comerciais, jurídicos ou de interface podem criar expectativa incorreta?
15. Quais evoluções devem ser explicitamente adiadas para não inflar o MVP?

## 15. Formato obrigatório da resposta

Entregue:

### A. Veredito executivo

- `GO`, `GO COM RESSALVAS` ou `NO-GO`;
- justificativa objetiva;
- no máximo cinco condições para liberar o lançamento.

### B. Matriz de riscos

Tabela com:

- criticidade;
- área;
- evidência fornecida;
- risco;
- correção recomendada;
- esforço estimado;
- bloqueia lançamento: sim/não;
- como validar.

### C. Projeto detalhado dos três fluxos pendentes

Separar:

1. recuperação cross-device;
2. cancelamento e reativação;
3. troca segura de slug.

Para cada um, fornecer sequência, estados, schema/migration, endpoints, segurança, interface, falhas e testes.

### D. Plano de execução

- **Agora, antes de divulgar**;
- **Primeira semana**;
- **Primeiro mês**;
- **Depois de validar demanda**;
- **Não fazer ainda**.

### E. Plano de testes

Incluir casos felizes, falhas, concorrência, reentrega, outro dispositivo, conexão interrompida, usuário repetido, cobrança recusada, webhook atrasado, cancelamento, reativação, retenção e isolamento entre tenants.

### F. Perguntas pendentes

Liste apenas perguntas cuja resposta realmente mude arquitetura, cobrança, privacidade ou lançamento. Não use perguntas para evitar emitir um parecer com as informações disponíveis.

Não forneça código completo nesta primeira análise. Pode apresentar pseudocódigo, máquina de estados, exemplos de schema e contratos de endpoint. Priorize decisões verificáveis e compatíveis com a operação enxuta do produto.
