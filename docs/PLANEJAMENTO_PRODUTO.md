# Planejamento de evolução do ClickCatálogo

Atualizado em 10 de setembro de 2026. Este documento registra ideias aprovadas para planejamento. Nenhum item abaixo está autorizado para publicação automática; cada fase deve passar por implementação, validação local e uma única release em lote.

## Objetivo

Evoluir o ClickCatálogo de uma ferramenta de catálogo por link para uma plataforma que também:

- ajuda o lojista a divulgar sua loja;
- permite descobrir lojas que autorizaram exposição pública;
- explica o produto e reduz dúvidas antes da assinatura;
- ensina tarefas do painel sem depender de atendimento;
- constrói aquisição orgânica com conteúdo útil e indexável.

## Princípios do produto

1. **Consentimento antes da descoberta:** ter um catálogo público por URL não autoriza sua inclusão automática em `/lojas`.
2. **Compartilhar deve funcionar sem cadastro do cliente:** usar recursos nativos do navegador e oferecer alternativa de copiar o link.
3. **Conteúdo ajuda a concluir uma tarefa:** priorizar guias objetivos antes de criar um blog amplo.
4. **Sem marketplace disfarçado:** a vitrine leva o visitante à loja; pedido, atendimento e pagamento dos produtos continuam sendo responsabilidade do lojista pelo WhatsApp.
5. **Privacidade por padrão:** não expor e-mail, telefone, endereço completo, status financeiro ou métricas internas no diretório.
6. **Uma release por fase:** acumular código, validar e publicar em lote para reduzir consumo de build da Netlify.

## Referência analisada

A referência `catalogoja.com` combina uma vitrine de lojas reais, páginas de explicação e uma central de ajuda orientada a tarefas. Os conceitos aproveitáveis são descoberta por exemplos reais, prova social e conteúdo que responde dúvidas antes e depois do cadastro.

O ClickCatálogo deve preservar identidade e escopo próprios. Não copiar textos, layout, nomes de rotas internas ou funcionalidades de orçamento da referência. Nosso diferencial atual continua sendo catálogo simples, carrinho no navegador e pedido consolidado no WhatsApp.

## Ordem de prioridade

| Prioridade | Entrega | Valor | Dependências |
|---|---|---|---|
| P0 | Finalizar testes controlados de produção já planejados | Protege cobrança, cancelamento e acesso antes de atrair tráfego | Checklist de pré-lançamento |
| P1 | Compartilhar loja + Open Graph completo | Divulgação imediata para cada lojista | Nenhuma migration obrigatória |
| P2 | Vitrine pública `/lojas` com adesão voluntária | Descoberta e prova social | Migration, opção no painel e RPC pública segura |
| P3 | FAQ e página `/como-funciona` | Conversão e redução de dúvidas | Conteúdo revisado e componentes existentes |
| P4 | Central `/ajuda` com guias por tarefa | Menos suporte e melhor ativação | Estrutura de conteúdo, busca futura |
| P5 | Blog editorial | Aquisição orgânica de longo prazo | Calendário, revisão e responsabilidade de manutenção |

## Triagem de produto antes do lançamento

Esta triagem separa correções necessárias para vender com segurança de melhorias que podem entrar depois. O objetivo é evitar transformar o pré-lançamento em uma reescrita, sem deixar falhas de cobrança, recuperação de acesso ou confiança visual chegarem ao cliente.

### Agora — antes de receber clientes reais

#### 1. Retomada segura depois do pagamento

**Estado atual:** a confirmação pode ser retomada enquanto o cliente conservar a URL `/cadastro/sucesso?ref=...`. A referência consulta a intenção no servidor e, depois do webhook, libera a criação da senha. Se a pessoa perder essa URL, o usuário já provisionado pode recuperar o acesso pelo fluxo de senha do painel, mas essa alternativa não está explicada na jornada de compra.

**Correção proposta:**

- manter a referência de retomada em cookie seguro e de curta duração antes de redirecionar ao Asaas;
- criar uma entrada **Continuar cadastro** que não dependa de conhecer a URL com `ref`;
- depois do pagamento confirmado, permitir recuperar/criar a senha pelo e-mail da contratação;
- mostrar claramente que um pagamento já identificado não deve ser repetido;
- futuramente enviar confirmação transacional com os links da loja e do painel, sem tornar o e-mail o único meio de recuperação;
- testar queda de internet, aba fechada antes do webhook, retorno em outro navegador e webhook atrasado.

A referência é uma credencial de retomada e não deve aparecer em logs públicos, analytics ou mensagens de erro.

#### 2. Intenções de cadastro e retorno do Asaas

**Estado atual:** é correto salvar `signup_intents` antes de abrir o checkout. O registro é necessário para ligar o pagamento aos dados da loja, impedir duplicação, validar aceites legais e processar reentregas do webhook com idempotência. Atualmente o checkout expira em 60 minutos, enquanto a intenção pendente possui expiração defensiva de 24 horas. Voltar para `/cadastro` abre um formulário vazio, embora a reserva continue ativa.

**Correção proposta:**

- não apagar nem recriar a intenção quando o cliente volta do Asaas;
- reconhecer a intenção do navegador e oferecer **Retomar pagamento** ou **Revisar cadastro**;
- exibir prazo e estado reais: pendente, pago, expirado ou cancelado;
- avaliar alinhar a reserva pendente à expiração do checkout mais uma margem de segurança, em vez de bloquear e-mail e slug por 24 horas;
- manter limpeza e retenção posteriores para auditoria, sem expor a tabela ao cliente.

#### 3. Verificação antecipada do e-mail

**Estado atual:** formato do e-mail, slug e aceites são validados na primeira etapa, mas a existência de outra loja para o e-mail só é consultada no servidor ao criar o checkout, depois da escolha do tema.

**Correção proposta:** consultar a disponibilidade ao avançar da primeira etapa, com rate limit e mensagem que leve diretamente a **Entrar** ou **Recuperar senha**. A checagem final do checkout deve continuar existindo e ser a validação autoritativa, pois uma pré-validação no navegador pode ficar desatualizada. A resposta deve ser desenhada para não facilitar enumeração automatizada de contas.

#### 4. Cancelamento no fim do período pago

**Estado atual e problema:** o cancelamento atual remove a recorrência no Asaas e marca assinatura e tenant como `cancelado` imediatamente. A loja sai do ar no mesmo momento, mesmo que o mês tenha acabado de ser pago.

**Regra recomendada para lançamento:** cancelar significa impedir a próxima renovação e manter painel e loja ativos até o fim do período já pago. Na interface, mostrar **Cancelamento agendado**, a data final de acesso e a confirmação de que não haverá nova cobrança.

Isso exige uma alteração coordenada:

- registrar `cancel_at_period_end` e `access_until` (ou estado equivalente) na assinatura;
- manter o tenant ativo até `access_until`;
- impedir que `SUBSCRIPTION_DELETED` derrube imediatamente uma loja com período pago vigente;
- executar uma rotina idempotente que desative a loja quando o período terminar;
- permitir desfazer o cancelamento somente se o Asaas suportar retomada segura; caso contrário, orientar nova assinatura;
- separar cancelamento de renovação, pedido de reembolso e exclusão de dados;
- atualizar assinatura, privacidade, termos, FAQ e testes de webhook com a mesma regra.

Este item é bloqueador para a primeira venda real porque muda o direito de uso do período já cobrado.

#### 5. Atendimento funcional e consistente

**Estado atual:** **Atendimento** e **Solicitar atendimento sobre dados** apontam para um endereço `mailto:`. Eles dependem de o dispositivo possuir um aplicativo de e-mail configurado; quando não possui, o clique parece não funcionar.

**Correção proposta:** centralizar os dois caminhos em `/atendimento`, mostrando o e-mail, botão para copiar e botão para abrir o aplicativo de e-mail. Se for adotado WhatsApp de suporte, ele deve ser um canal oficial separado do WhatsApp das lojas. Pedidos de LGPD devem continuar identificados e auditáveis; não prometer atendimento em prazo que ainda não exista.

#### 6. Ícone da aplicação

**Estado atual:** existe somente `src/app/favicon.ico`, criado junto à base inicial e ainda percebido como o símbolo padrão da tecnologia.

**Correção proposta:** criar um conjunto próprio e simples do ClickCatálogo (`favicon.ico`, `icon.png`/`icon.svg` compatível, `apple-icon.png` e manifesto apenas se houver PWA). Validar cache, aba do navegador, favorito, Android e iOS. A marca deve continuar legível em 16 × 16 px e não depender do nome por extenso.

### Logo depois do lançamento controlado

#### 7. Formatação monetária no cadastro de produto

Transformar o campo em entrada brasileira de moeda: exibir `R$ 1.234,56`, aceitar digitação por centavos e normalizar uma única vez antes da Server Action. O servidor continua validando limites e não confia no texto formatado. Idealmente, valores passam a ser tratados internamente em centavos; enquanto o banco permanecer `numeric(10,2)`, cobrir conversões e arredondamento com testes.

#### 8. Troca do endereço da loja

Não fazer uma simples atualização de `tenants.slug`, pois links já enviados e resultados de busca quebrariam. Planejar:

- confirmação explícita, validação de nomes reservados e limite de frequência;
- alteração atômica e única por tenant;
- tabela de histórico com `old_slug`, `tenant_id`, `redirect_until`, `released_at` e motivo da alteração;
- somente o endereço atual e, no máximo, o endereço imediatamente anterior podem responder pela loja;
- redirecionamento temporário do endereço anterior para o atual por 90 dias;
- depois do redirecionamento, quarentena de 30 dias exibindo uma página neutra de endereço alterado, sem revelar dados privados;
- liberação automática do slug para outro cliente após 120 dias, mantendo o registro apenas para auditoria, sem continuar reservando o nome;
- ao ser liberado ou reutilizado, qualquer redirecionamento antigo deve estar definitivamente desativado;
- atualização de URL canônica, sitemap e Open Graph no momento da alteração;
- intervalo mínimo de 90 dias entre trocas, evitando acúmulo de aliases ativos e abuso;
- revalidação do catálogo e dos cartões sociais.

Essa política aceita um risco residual inevitável: depois que um slug é liberado e reutilizado, links muito antigos poderão abrir a nova loja. Reserva permanente eliminaria esse risco, mas bloquearia nomes úteis para sempre. O período de 120 dias cria uma transição previsível sem transformar o histórico em posse vitalícia do endereço. Os prazos devem ficar configuráveis no código para ajuste futuro com base no uso real.

#### 9. Página individual de produto

Criar `/loja/[slug]/produto/[produtoSlug]` ou rota equivalente estável, sem remover os cards e o carrinho atuais. A página deve ter imagem maior, nome, preço, descrição completa, variações, loja de origem, adicionar ao carrinho, pedir pelo WhatsApp e compartilhar. Incluir metadados e Open Graph por produto, fallback de imagem, URL canônica e regra para produto oculto/inexistente.

A referência analisada usa páginas individuais principalmente para busca e compartilhamento. O ClickCatálogo deve manter o pedido consolidado pelo WhatsApp e não copiar layout, textos ou recursos de orçamento que pertencem a outro produto.

#### 10. Analytics antes de mídia paga

Instrumentar primeiro o funil do próprio ClickCatálogo, sem enviar e-mail, WhatsApp, nome da loja, conteúdo do carrinho ou outros dados pessoais:

- landing → cadastro;
- etapa 1 → tema;
- tema → checkout;
- checkout confirmado;
- senha configurada e primeiro acesso;
- primeira categoria, primeiro produto e primeira publicação;
- compartilhamento da loja;
- abertura do carrinho e clique para enviar pedido no WhatsApp;
- cancelamento iniciado e concluído.

Escolher GA4 e Meta Pixel somente após definir consentimento, atualizar a Política de Privacidade e implementar Consent Mode/camada equivalente quando aplicável. Não registrar **compra de produto** no catálogo, pois o clique no WhatsApp não comprova que a venda foi concluída. O Meta Pixel torna-se prioridade antes de campanha paga no Facebook ou Instagram, não antes do lançamento orgânico controlado.

### Evolução e experimentos posteriores

#### 11. Banner promocional

O banner de capa da loja já existe e é editável no painel. Uma nova **área de banner** deve significar promoção interna do catálogo, separada da capa. Começar com um único banner ativo — imagem, texto alternativo, link opcional, datas de início/fim e opção de ocultar — antes de considerar carrossel. Preservar desempenho mobile, proporção fixa e contraste.

#### 12. Login com Google

Planejar OAuth pelo Supabase, com projeto no Google Cloud, tela de consentimento, Client ID/Secret, callback PKCE e URLs autorizadas. O ponto crítico não é o botão: é vincular com segurança uma conta Google a um usuário que já possui senha e o mesmo e-mail, sem criar segundo tenant nem perder o vínculo da assinatura. Testar conta existente, conta nova, recusa de consentimento, e-mail sem correspondência e recuperação de acesso.

#### 13. Teste gratuito sem cartão

Tratar como experimento comercial, não como simples desconto. Antes de escolher 3 ou 7 dias, medir abandono no checkout e ativação dos primeiros clientes. A implementação exigiria estado `trialing`, `trial_ends_at`, rotina de expiração, regra de visibilidade da loja, conversão para assinatura, avisos, prevenção de abuso e atualização legal. Uma alternativa de menor risco é permitir montar a loja gratuitamente e exigir assinatura apenas para publicá-la.

#### 14. Integração com Instagram

Separar três níveis:

1. **Divulgação simples:** link da loja na bio, compartilhamento e Open Graph de loja/produto;
2. **Medição:** Meta Pixel do próprio ClickCatálogo, com consentimento e sem misturar dados dos tenants;
3. **Instagram Shopping real:** sincronização de catálogo via ecossistema Meta, autenticação do lojista, tokens renováveis, IDs estáveis de produto, disponibilidade/estoque, exclusões, revisão do aplicativo e conformidade com as regras vigentes da Meta.

O nível 1 vem junto das páginas compartilháveis. O nível 3 fica para depois da página individual de produto, da identidade estável dos itens e da validação de demanda, pois adiciona suporte operacional e dependência de aprovação externa.

## Ordem prática atualizada

| Momento | Pacote | Condição de saída |
|---|---|---|
| Antes da primeira venda | Retomada pós-pagamento, validação antecipada de conta, cancelamento no fim do período, atendimento e favicon | Fluxos de falha e cobrança testados sem perda de acesso |
| Lançamento controlado | Preço oficial restaurado, checklist financeiro completo e divulgação orgânica limitada | Uma contratação e um cancelamento reais auditados |
| Primeira melhoria | Moeda, compartilhar + Open Graph, analytics básico e página de produto | Eventos sem PII e previews sociais validados |
| Crescimento | Slug com redirecionamento, vitrine, FAQ/ajuda e banner promocional | Métricas e suporte justificam cada recurso |
| Experimentos | Google Login, teste grátis e integração completa com Instagram | Hipótese, custo operacional e critério de sucesso definidos |

## Fase P1 — Compartilhar loja e apresentação social

### Experiência

- adicionar **Compartilhar loja** no painel, próximo de **Abrir loja**;
- adicionar uma ação discreta de compartilhamento na loja pública, sem competir com **Chamar no WhatsApp** e o carrinho;
- no celular, usar `navigator.share()` quando disponível;
- em desktop ou navegador incompatível, copiar a URL para a área de transferência;
- mostrar confirmação acessível: **Link da loja copiado**;
- nunca solicitar permissões, contatos ou login social para compartilhar;
- preservar um link visível/copíavel caso a Clipboard API falhe.

### Open Graph e SEO

A rota `/loja/[slug]` já gera título, descrição, URL canônica e dados básicos de Open Graph. Falta completar a apresentação visual compartilhada:

- `openGraph.images` com imagem em proporção social;
- `twitter.card = summary_large_image` e respectivos título, descrição e imagem;
- imagem dinâmica por loja, preferencialmente em `/loja/[slug]/opengraph-image`;
- dimensões-alvo de 1200 × 630 px;
- composição com nome, descrição curta, logo e identidade do tema;
- fallback integral quando logo ou banner não existirem;
- texto com limite e quebra segura para nomes longos;
- nenhuma informação financeira, telefone ou endereço na imagem;
- usar `NEXT_PUBLIC_SITE_URL` para URLs absolutas, sem domínio fixo no código.

### Validação

- Web Share API em Android/iOS compatíveis;
- cópia do link em Chrome, Edge e Firefox desktop;
- teclado e leitor de tela;
- WhatsApp, Facebook Sharing Debugger e LinkedIn Post Inspector;
- imagem correta com e sem logo/banner;
- loja cancelada ou inexistente continua sem indexação e sem cartão promocional enganoso.

## Fase P2 — Vitrine pública de lojas

### Rotas propostas

- `/lojas`: vitrine indexável de lojas participantes;
- `/lojas?busca=...`: filtro por nome, descrição, segmento e cidade quando esses dados existirem;
- os cards apontam para a rota atual `/loja/[slug]`; não criar uma segunda página da mesma loja.

### Conteúdo inicial do card

- logo ou fallback temático;
- nome da loja;
- descrição curta;
- segmento e cidade apenas se o lojista preencher e autorizar;
- chamada **Ver catálogo**;
- nunca exibir WhatsApp, e-mail, endereço completo, quantidade de pedidos ou situação da assinatura.

### Consentimento e qualidade

- nova opção no painel: **Quero que minha loja apareça na vitrine pública do ClickCatálogo**;
- desmarcada por padrão;
- explicar que a loja poderá aparecer em buscas e mecanismos de pesquisa;
- permitir retirada imediata pelo próprio painel;
- incluir somente tenants `ativo`, com consentimento vigente e pelo menos um produto ativo;
- prever `listed_at`/data de adesão para auditoria;
- não usar `status = inadimplente` como dado público nem revelar o motivo de uma remoção;
- inicialmente usar ordenação neutra ou rotação determinística; não prometer “destaque” pago sem regra comercial definida;
- reservar moderação administrativa para abuso, fraude, conteúdo proibido e violação de direitos.

### Alteração de banco proposta

Criar migration versionada, refletida também em `supabase/schema.sql` e nos tipos TypeScript:

- `tenants.public_listing_enabled boolean not null default false`;
- `tenants.public_listing_enabled_at timestamptz null`;
- opcional após decisão de produto: `segmento text null` e `cidade text null` com limites e normalização;
- índice parcial para lojas listadas e ativas;
- RPC `get_public_store_directory(...)` que devolva somente campos aprovados, com paginação e busca limitada;
- nenhuma consulta pública direta à tabela `tenants`.

O consentimento de vitrine é diferente do consentimento legal do cadastro. A alteração deve ficar registrada e ser reversível pelo titular.

### Performance

- página server-rendered com revalidação;
- paginação real no servidor, não carregar todas as lojas no navegador;
- imagens via `next/image` e tamanhos explícitos;
- busca com debounce e parâmetros de URL compartilháveis;
- começar sem geolocalização, distância ou mapa;
- medir antes de adicionar ranking complexo.

### Antispam e segurança

- validação de tamanho e conteúdo dos campos públicos;
- rate limit para a RPC/endpoint de busca, se necessário após medição;
- botão **Denunciar loja** apenas quando houver processo real de atendimento/moderação;
- política de uso deve definir itens e atividades proibidos antes de abrir listagem em escala;
- logs não devem registrar consultas com IP bruto nem dados pessoais desnecessários.

### Critérios de aceite

- uma loja nova não aparece automaticamente;
- ativar a opção inclui a loja após a janela de revalidação;
- desativar remove a loja da vitrine;
- loja cancelada não aparece;
- loja sem produto ativo não aparece;
- busca e paginação não vazam campos privados;
- layout validado em 375, 768, 1024 e 1440 px;
- sitemap inclui `/lojas` e mantém as lojas individuais conforme a política de indexação.

## Fase P3 — FAQ e “Como funciona”

### `/como-funciona`

Explicar o percurso real, sem prometer recurso inexistente:

1. criar a loja e concluir a assinatura;
2. cadastrar categorias e produtos;
3. personalizar identidade e informações;
4. compartilhar o link;
5. cliente monta o pedido e envia pelo WhatsApp.

Incluir chamadas para demonstração, cadastro e painel. Reutilizar tokens, cards, botões e tipografia existentes.

### FAQ inicial

- O cliente precisa criar conta?
- Como o pedido chega no WhatsApp?
- O ClickCatálogo recebe comissão sobre minhas vendas?
- Posso alterar preços e fotos depois?
- Posso cancelar quando quiser?
- Quais imagens posso enviar?
- Minha loja pode aparecer na vitrine pública?
- O pagamento da assinatura é seguro?
- O que acontece se a assinatura atrasar ou for cancelada?

Usar acordeão acessível, funcional por teclado e toque. Dados estruturados `FAQPage` só devem representar perguntas e respostas realmente visíveis na página e devem ser reavaliados conforme as regras atuais dos mecanismos de busca na implementação.

## Fase P4 — Central de ajuda

### Estrutura

- `/ajuda`: categorias e busca;
- `/ajuda/[slug]`: artigos individuais;
- navegação **Anterior/Próximo** e artigos relacionados;
- indicação de última atualização;
- CTA contextual para abrir o painel ou criar uma loja;
- feedback simples **Este artigo ajudou?**, sem coletar dado pessoal no MVP.

### Primeiros guias

1. Como criar sua loja;
2. Como escolher o endereço da loja;
3. Como cadastrar uma categoria;
4. Como cadastrar um produto com foto e preço;
5. Como trocar logo e banner;
6. Como configurar o WhatsApp corretamente;
7. Como adicionar o Instagram;
8. Como ocultar ou reativar um produto;
9. Como compartilhar sua loja;
10. Como funciona o carrinho e o pedido pelo WhatsApp;
11. Como recuperar a senha;
12. Como consultar e cancelar a assinatura;
13. Como solicitar exclusão dos dados;
14. Como aparecer ou deixar de aparecer na vitrine pública.

### Tecnologia recomendada

Começar com conteúdo versionado no repositório, em MDX ou estrutura TypeScript tipada. Isso mantém custo zero, revisão por Git, build previsível e nenhum novo painel administrativo. Só adotar CMS quando uma pessoa não técnica precisar publicar com frequência suficiente para justificar custo e superfície de segurança adicionais.

Cada artigo deve ter `title`, `description`, `category`, `updatedAt`, `order` e conteúdo. Links quebrados, títulos duplicados e metadados ausentes devem entrar na rotina de verificação do projeto.

## Fase P5 — Blog editorial

O blog entra depois da central de ajuda porque exige frequência, revisão e manutenção. Separar intenção:

- `/ajuda`: ensina a usar o produto;
- `/blog`: ajuda o pequeno negócio a vender e organizar o catálogo;
- `/como-funciona`: explica a proposta comercial.

### Ideias iniciais

- Como montar um catálogo para vender pelo WhatsApp;
- Como fotografar produtos com o celular;
- O que escrever na descrição de um produto;
- Como organizar categorias sem confundir o cliente;
- Como divulgar o link do catálogo no Instagram;
- Como reduzir perguntas repetidas no WhatsApp;
- Exemplos de mensagem para compartilhar sua loja;
- Catálogo digital ou PDF: quando usar cada um;
- Checklist para publicar sua primeira loja;
- Histórias de lojistas, somente com autorização expressa.

Não criar artigos automáticos ou páginas por cidade/segmento com pouco conteúdo. Evitar conteúdo duplicado, promessas de vendas e depoimentos fictícios.

## Perguntas e respostas: escopo recomendado

Nesta etapa, **perguntas e respostas** significa FAQ editorial e central de ajuda. Não abrir comentários, fórum ou perguntas públicas de usuários no MVP, pois isso exige moderação, proteção contra spam, tratamento de dados pessoais, notificações e regras de remoção.

Um formulário de contato pode ser planejado separadamente quando existir rotina de atendimento, prazo de resposta e proteção antispam. O canal atual `contato@clickcatalogo.com` pode continuar como destino de suporte.

## Métricas mínimas, com privacidade

Antes de escolher uma ferramenta de analytics, definir os eventos úteis:

- clique em **Compartilhar loja**;
- compartilhamento nativo concluído ou link copiado;
- abertura de loja a partir de `/lojas`;
- clique em **Criar minha loja** após FAQ/ajuda;
- artigo visualizado e feedback de utilidade;
- busca sem resultado na vitrine ou ajuda.

Não enviar nome da loja, e-mail, WhatsApp, conteúdo do carrinho ou termos de busca potencialmente pessoais para analytics sem avaliação de privacidade e consentimento aplicável.

## Pacotes de entrega sugeridos

### Release A — divulgação

- botão de compartilhar no painel e catálogo;
- Open Graph/Twitter completo por loja;
- testes e auditoria de previews sociais.

### Release B — descoberta

- migration de consentimento;
- controle no painel;
- RPC paginada;
- `/lojas` e atualização do sitemap;
- revisão legal e moderação mínima.

### Release C — conteúdo essencial

- `/como-funciona`;
- FAQ na landing e página apropriada;
- `/ajuda` com os primeiros artigos;
- sitemap, metadados e verificação de links.

### Release D — crescimento editorial

- blog;
- calendário de conteúdo;
- métricas de aquisição e conversão;
- estudos de caso autorizados.

## Próxima decisão

Depois dos testes de produção atuais, iniciar pela **Release A**. Ela entrega valor para todas as lojas existentes, não precisa expor novos dados no banco e prepara os cartões sociais usados tanto pelos lojistas quanto pela futura vitrine.
